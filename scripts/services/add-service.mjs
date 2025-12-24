/**
 * Add Service
 *
 * Erstellt neue Tasks und Bugs.
 * Nutzt den TaskAdapter für automatische Synchronisation.
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { TaskStatus } from '../core/table/schema.mjs';
import { parseDeps } from '../core/table/parser.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';

/**
 * Erstellt einen Add-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @returns {object}
 */
export function createAddService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();

  return {
    /**
     * Fügt eine neue Task hinzu
     */
    addTask(taskData, opts = {}) {
      const { dryRun = false, init = false } = opts;
      const { domain, beschreibung, doc, prio, mvp, deps, spec } = taskData;

      // --doc ist erforderlich für Tasks
      if (!doc) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--doc erforderlich (z.B. --doc features/Travel-System.md)'
        });
      }

      if (!domain || !beschreibung) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--domain und --beschreibung erforderlich'
        });
      }

      // Adapter kümmert sich um ID-Generierung und Einfügen
      const result = taskAdapter.addTask({
        domain,
        beschreibung,
        prio: prio || 'mittel',
        mvp: mvp || 'Nein',
        deps: deps ? parseDeps(deps) : [],
        spec: spec || '-',
        isBug: false
      }, { dryRun, doc, init });

      if (!result.ok) {
        return result;
      }

      return ok({
        success: true,
        taskId: result.value.newId,
        line: result.value.line,
        doc: result.value.doc,
        dryRun
      });
    },

    /**
     * Fügt einen neuen Bug hinzu
     */
    addBug(beschreibung, bugData = {}, opts = {}) {
      const { dryRun = false } = opts;
      const { prio = 'hoch', deps = '-' } = bugData;

      if (!beschreibung) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--beschreibung erforderlich'
        });
      }

      // 1. Bug erstellen via Adapter
      const bugResult = taskAdapter.addTask({
        beschreibung,
        prio,
        deps: deps !== '-' ? parseDeps(deps) : [],
        isBug: true
      }, { dryRun });

      if (!bugResult.ok) {
        return bugResult;
      }

      const newBugId = bugResult.value.newId;
      const affectedTasks = [];

      // 2. Bug-Propagation: Referenzierte Tasks auf BROKEN setzen
      if (deps && deps !== '-' && !dryRun) {
        const taskRefs = parseDeps(deps);

        // Roadmap laden um Task-Daten zu bekommen
        const loadResult = taskAdapter.load();
        if (loadResult.ok) {
          const { tasks } = loadResult.value;

          for (const ref of taskRefs) {
            if (typeof ref === 'number') {
              const task = tasks.find(t => t.number === ref);
              if (task) {
                // Bug zu Dependencies hinzufügen
                const newDeps = task.depsRaw === '-'
                  ? newBugId
                  : `${task.depsRaw}, ${newBugId}`;

                // Task via Adapter aktualisieren (automatische Sync)
                const updateResult = taskAdapter.updateTask(ref, {
                  status: TaskStatus.BROKEN,
                  deps: newDeps
                }, { dryRun });

                if (updateResult.ok) {
                  affectedTasks.push({
                    taskId: ref,
                    oldDeps: task.depsRaw,
                    newDeps,
                    oldStatus: task.status,
                    newStatus: TaskStatus.BROKEN,
                    docs: updateResult.value.docs
                  });
                }
              }
            }
          }
        }
      }

      return ok({
        success: true,
        bugId: newBugId,
        line: bugResult.value.line,
        affectedTasks,
        dryRun
      });
    }
  };
}

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Parst CLI-Argumente für add command
 */
export function parseArgs(argv) {
  const opts = {
    type: null,
    beschreibung: null,
    domain: null,
    doc: null,
    init: false,
    prio: null,
    mvp: null,
    deps: null,
    spec: null,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--task') {
      opts.type = 'task';
    } else if (arg === '--bug') {
      opts.type = 'bug';
    } else if (arg === '--beschreibung' || arg === '-m') {
      opts.beschreibung = argv[++i];
    } else if (arg === '--domain' || arg === '-b') {
      opts.domain = argv[++i];
    } else if (arg === '--doc') {
      opts.doc = argv[++i];
    } else if (arg === '--init') {
      opts.init = true;
    } else if (arg === '--prio' || arg === '-p') {
      opts.prio = argv[++i];
    } else if (arg === '--mvp') {
      opts.mvp = argv[++i];
    } else if (arg === '--deps' || arg === '-d') {
      opts.deps = argv[++i];
    } else if (arg === '--spec') {
      opts.spec = argv[++i];
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    }
  }

  return opts;
}

/**
 * Führt den add command aus
 */
export function execute(opts, service = null) {
  const addService = service ?? createAddService();

  if (opts.type === 'task') {
    return addService.addTask({
      domain: opts.domain,
      beschreibung: opts.beschreibung,
      doc: opts.doc,
      prio: opts.prio,
      mvp: opts.mvp,
      deps: opts.deps,
      spec: opts.spec
    }, { dryRun: opts.dryRun, init: opts.init });
  } else if (opts.type === 'bug') {
    return addService.addBug(opts.beschreibung, {
      prio: opts.prio,
      deps: opts.deps
    }, { dryRun: opts.dryRun });
  }

  return err({
    code: TaskErrorCode.INVALID_FORMAT,
    message: '--task oder --bug erforderlich'
  });
}

/**
 * Zeigt Hilfe für add command
 */
export function showHelp() {
  return `
Add Command - Neue Task oder Bug erstellen

USAGE:
  node scripts/task.mjs add --task --doc <path> [OPTIONS]
  node scripts/task.mjs add --bug [OPTIONS]

TYP (erforderlich):
  --task                 Neue Task erstellen
  --bug                  Neuen Bug erstellen

OPTIONEN (Task):
  --doc <path>           Ziel-Dokument (relativ zu docs/) [erforderlich]
  --init                 Erstellt Tabelle im Doc falls nicht vorhanden
  -b, --domain <name>    Domain (z.B. Travel, Map) [erforderlich]
  -m, --beschreibung "." Beschreibung [erforderlich]
  -p, --prio <prio>      Priorität (hoch, mittel, niedrig) [default: mittel]
  --mvp <Ja|Nein>        MVP-Status [default: Nein]
  -d, --deps "<deps>"    Dependencies (z.B. "#100, #202")
  --spec "File.md#..."   Spec-Referenz

OPTIONEN (Bug):
  -m, --beschreibung "." Beschreibung [erforderlich]
  -p, --prio <prio>      Priorität [default: hoch]
  -d, --deps "<deps>"    Betroffene Tasks (werden auf BROKEN gesetzt)

ALLGEMEIN:
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task.mjs add --task --doc features/Travel-System.md -b Travel -m "Neue Route"
  node scripts/task.mjs add --task --doc domain/Quest.md --init -b Quest -m "Quest-Log UI"
  node scripts/task.mjs add --bug -m "Login funktioniert nicht" --deps "#428"

HINWEISE:
  - Tasks werden immer sowohl in der Roadmap als auch im angegebenen Doc gespeichert
  - Das Doc muss eine Task-Tabelle enthalten (oder --init verwenden)
  - Bugs werden nur in der Roadmap gespeichert (kein --doc erforderlich)
`;
}

/**
 * Default Add-Service Instanz
 */
export const defaultAddService = createAddService();
