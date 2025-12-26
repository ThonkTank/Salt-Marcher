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
      const { domain, layer, beschreibung, doc, prio, mvp, deps, spec } = taskData;

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
        layer: layer || '-',
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
    layer: null,
    doc: null,
    init: false,
    prio: null,
    mvp: null,
    deps: null,
    spec: null,
    // Bulk-Mode
    tasks: null,  // JSON-Array für Bulk-Tasks
    bugs: null,   // JSON-Array für Bulk-Bugs
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
    } else if (arg === '--tasks') {
      opts.tasks = argv[++i];
    } else if (arg === '--bugs') {
      opts.bugs = argv[++i];
    } else if (arg === '--beschreibung' || arg === '-m') {
      opts.beschreibung = argv[++i];
    } else if (arg === '--domain' || arg === '-b') {
      opts.domain = argv[++i];
    } else if (arg === '--doc') {
      opts.doc = argv[++i];
    } else if (arg === '--layer' || arg === '-l') {
      opts.layer = argv[++i];
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

  // Bulk-Mode: --tasks oder --bugs
  if (opts.tasks) {
    return executeBulkTasks(opts.tasks, addService, opts);
  }
  if (opts.bugs) {
    return executeBulkBugs(opts.bugs, addService, opts);
  }

  // Single-Mode: --task oder --bug mit -m
  if (opts.type === 'task') {
    return addService.addTask({
      domain: opts.domain,
      layer: opts.layer,
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
 * Führt Bulk-Add für Tasks aus
 */
function executeBulkTasks(jsonString, addService, globalOpts) {
  // 1. JSON parsen
  let tasks;
  try {
    tasks = JSON.parse(jsonString);
  } catch (e) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültiges JSON: ${e.message}`
    });
  }

  // 2. Validierung: Array mit min. 1 Element
  if (!Array.isArray(tasks)) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: '--tasks muss ein JSON-Array sein'
    });
  }
  if (tasks.length === 0) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: '--tasks Array darf nicht leer sein'
    });
  }

  // 3. Über alle Tasks iterieren (Partial Success)
  const results = {
    success: [],
    failed: [],
    dryRun: globalOpts.dryRun
  };

  for (let i = 0; i < tasks.length; i++) {
    const taskData = tasks[i];
    const taskIndex = i + 1;

    // Pflichtfelder prüfen
    if (!taskData.beschreibung) {
      results.failed.push({
        taskIndex,
        error: { message: 'beschreibung fehlt' }
      });
      continue;
    }
    if (!taskData.doc) {
      results.failed.push({
        taskIndex,
        error: { message: 'doc fehlt' }
      });
      continue;
    }
    if (!taskData.domain) {
      results.failed.push({
        taskIndex,
        error: { message: 'domain fehlt' }
      });
      continue;
    }

    // addTask aufrufen
    const result = addService.addTask({
      domain: taskData.domain,
      layer: taskData.layer,
      beschreibung: taskData.beschreibung,
      doc: taskData.doc,
      prio: taskData.prio,
      mvp: taskData.mvp,
      deps: taskData.deps,
      spec: taskData.spec
    }, {
      dryRun: globalOpts.dryRun,
      init: taskData.init ?? false
    });

    if (result.ok) {
      results.success.push({
        taskId: result.value.taskId,
        doc: result.value.doc?.path ?? taskData.doc,
        beschreibung: taskData.beschreibung
      });
    } else {
      results.failed.push({
        taskIndex,
        error: result.error
      });
    }
  }

  return ok(results);
}

/**
 * Führt Bulk-Add für Bugs aus
 */
function executeBulkBugs(jsonString, addService, globalOpts) {
  // 1. JSON parsen
  let bugs;
  try {
    bugs = JSON.parse(jsonString);
  } catch (e) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: `Ungültiges JSON: ${e.message}`
    });
  }

  // 2. Validierung: Array mit min. 1 Element
  if (!Array.isArray(bugs)) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: '--bugs muss ein JSON-Array sein'
    });
  }
  if (bugs.length === 0) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: '--bugs Array darf nicht leer sein'
    });
  }

  // 3. Über alle Bugs iterieren (Partial Success)
  const results = {
    success: [],
    failed: [],
    propagation: [],
    dryRun: globalOpts.dryRun
  };

  for (let i = 0; i < bugs.length; i++) {
    const bugData = bugs[i];
    const bugIndex = i + 1;

    // Pflichtfeld prüfen
    if (!bugData.beschreibung) {
      results.failed.push({
        bugIndex,
        error: { message: 'beschreibung fehlt' }
      });
      continue;
    }

    // addBug aufrufen
    const result = addService.addBug(bugData.beschreibung, {
      prio: bugData.prio,
      deps: bugData.deps
    }, { dryRun: globalOpts.dryRun });

    if (result.ok) {
      results.success.push({
        bugId: result.value.bugId,
        beschreibung: bugData.beschreibung
      });
      // Propagation sammeln
      if (result.value.affectedTasks?.length > 0) {
        for (const affected of result.value.affectedTasks) {
          results.propagation.push({
            id: affected.taskId,
            oldStatus: affected.oldStatus,
            newStatus: affected.newStatus,
            reason: `Bug ${result.value.bugId}`
          });
        }
      }
    } else {
      results.failed.push({
        bugIndex,
        error: result.error
      });
    }
  }

  return ok(results);
}

/**
 * Zeigt Hilfe für add command
 */
export function showHelp() {
  return `
Add Command - Neue Task oder Bug erstellen

USAGE (Single):
  node scripts/task.mjs add --task --doc <path> [OPTIONS]
  node scripts/task.mjs add --bug [OPTIONS]

USAGE (Bulk):
  node scripts/task.mjs add --tasks '<JSON-Array>'
  node scripts/task.mjs add --bugs '<JSON-Array>'

TYP (erforderlich für Single-Mode):
  --task                 Neue Task erstellen
  --bug                  Neuen Bug erstellen

BULK-MODE:
  --tasks '<JSON>'       Mehrere Tasks auf einmal (JSON-Array)
  --bugs '<JSON>'        Mehrere Bugs auf einmal (JSON-Array)

OPTIONEN (Task):
  --doc <path>           Ziel-Dokument (relativ zu docs/) [erforderlich]
  --init                 Erstellt Tabelle im Doc falls nicht vorhanden
  -b, --domain <name>    Domain (z.B. Travel, Map) [erforderlich]
  -l, --layer <layer>    Layer (core, features, infra, apps) [default: -]
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

BEISPIELE (Single):
  node scripts/task.mjs add --task --doc features/Travel-System.md -b Travel -m "Neue Route"
  node scripts/task.mjs add --task --doc domain/Quest.md --init -b Quest -m "Quest-Log UI"
  node scripts/task.mjs add --bug -m "Login funktioniert nicht" --deps "#428"

BEISPIELE (Bulk):
  # Mehrere Tasks auf einmal
  node scripts/task.mjs add --tasks '[
    {"beschreibung": "Task A", "doc": "features/Travel-System.md", "domain": "Travel"},
    {"beschreibung": "Task B", "doc": "features/Map-Feature.md", "domain": "Map", "prio": "hoch"}
  ]'

  # Mehrere Bugs auf einmal
  node scripts/task.mjs add --bugs '[
    {"beschreibung": "Bug A", "prio": "hoch", "deps": "#428"},
    {"beschreibung": "Bug B"}
  ]'

JSON-SCHEMA (Task):
  {
    "beschreibung": "...",  // erforderlich
    "doc": "...",           // erforderlich (relativ zu docs/)
    "domain": "...",        // erforderlich
    "layer": "...",         // optional, default: -
    "prio": "...",          // optional, default: mittel
    "mvp": "Ja|Nein",       // optional, default: Nein
    "deps": "#100, #202",   // optional
    "spec": "...",          // optional
    "init": true|false      // optional, default: false
  }

JSON-SCHEMA (Bug):
  {
    "beschreibung": "...",  // erforderlich
    "prio": "...",          // optional, default: hoch
    "deps": "#428"          // optional (betroffene Tasks)
  }

HINWEISE:
  - Tasks werden immer sowohl in der Roadmap als auch im angegebenen Doc gespeichert
  - Das Doc muss eine Task-Tabelle enthalten (oder "init": true im JSON)
  - Bugs werden nur in der Roadmap gespeichert (kein doc erforderlich)
  - Bulk-Mode: Partial Success - fehlerhafte Items stoppen nicht die anderen
`;
}

/**
 * Default Add-Service Instanz
 */
export const defaultAddService = createAddService();
