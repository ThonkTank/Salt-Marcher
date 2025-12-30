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
import { resolveMultiLocations, parseCommaSeparated } from './location-resolver.mjs';
import { validateSpecs } from './spec-validator.mjs';
import { validateImpls } from './impl-validator.mjs';

// ============================================================================
// DESCRIPTION NORMALIZATION
// ============================================================================

/**
 * Normalisiert eine Beschreibung für Tabellen-/CLI-Kompatibilität.
 *
 * @param {string} text - Rohe Beschreibung
 * @returns {string} - Normalisierte Beschreibung
 */
function normalizeBeschreibung(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/\|/g, '\\|')      // Pipe escapen (Tabellen-Separator)
    .replace(/\n/g, ' ')        // Newlines zu Spaces
    .replace(/\r/g, '')         // Carriage Returns entfernen
    .replace(/\t/g, ' ')        // Tabs zu Spaces
    .replace(/`/g, "'")         // Backticks zu Apostrophen
    .replace(/\s+/g, ' ')       // Mehrfach-Spaces normalisieren
    .trim();
}

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
     *
     * Alle Felder sind Pflicht:
     * - domain: Komma-separiert für Multi-Domain
     * - layer: Komma-separiert für Multi-Layer
     * - beschreibung: Task-Beschreibung
     * - deps: Dependencies oder "-"
     * - specs: Spec-Referenzen (datei.md#abschnitt)
     * - impl: Impl-Referenzen (datei.ts.funktion() [tag])
     */
    addTask(taskData, opts = {}) {
      const { dryRun = false, init = false } = opts;
      const { domain, layer, beschreibung, prio, mvp, deps, specs, impl } = taskData;

      // ========================================
      // 1. PFLICHTFELD-VALIDIERUNG
      // ========================================

      if (!domain || domain.trim() === '') {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--domain (-b) ist erforderlich'
        });
      }

      if (!layer || layer.trim() === '') {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--layer (-l) ist erforderlich'
        });
      }

      if (!beschreibung || beschreibung.trim() === '') {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--beschreibung (-m) ist erforderlich'
        });
      }

      if (deps === undefined || deps === null || deps.trim() === '') {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--deps (-d) ist erforderlich (use \'-\' if none)'
        });
      }

      if (!specs || specs.trim() === '') {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--specs (-s) ist erforderlich'
        });
      }

      if (!impl || impl.trim() === '') {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: '--impl (-i) ist erforderlich'
        });
      }

      // ========================================
      // 2. BESCHREIBUNG NORMALISIEREN
      // ========================================

      const normalizedBeschreibung = normalizeBeschreibung(beschreibung);
      if (!normalizedBeschreibung) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: 'Beschreibung darf nicht leer sein nach Normalisierung'
        });
      }

      // ========================================
      // 3. MULTI-DOMAIN/LAYER PARSEN
      // ========================================

      const domains = parseCommaSeparated(domain);
      const layers = parseCommaSeparated(layer);

      if (domains.length === 0) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: 'Mindestens eine Domain erforderlich'
        });
      }

      if (layers.length === 0) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: 'Mindestens ein Layer erforderlich'
        });
      }

      // ========================================
      // 4. LOCATION RESOLUTION
      // ========================================

      const locationResult = resolveMultiLocations(domains, layers);
      if (!locationResult.ok) {
        return err({
          code: TaskErrorCode.FILE_NOT_FOUND,
          message: `Speicherort-Auflösung fehlgeschlagen: ${locationResult.error.message}`,
          details: locationResult.error
        });
      }

      const { docs } = locationResult.value;

      // ========================================
      // 5. DEPS VALIDIEREN
      // ========================================

      let parsedDeps = [];
      if (deps !== '-') {
        parsedDeps = parseDeps(deps);

        // Deps in Roadmap prüfen
        const loadResult = taskAdapter.load();
        if (loadResult.ok) {
          const { tasks, bugs } = loadResult.value;
          const allIds = new Set([
            ...tasks.map(t => t.number),
            ...bugs.map(b => b.number)
          ]);

          for (const depId of parsedDeps) {
            if (typeof depId === 'number' && !allIds.has(depId)) {
              return err({
                code: TaskErrorCode.DEP_NOT_FOUND,
                message: `Dependency nicht gefunden: #${depId}`
              });
            }
            if (typeof depId === 'string' && !allIds.has(depId)) {
              return err({
                code: TaskErrorCode.DEP_NOT_FOUND,
                message: `Dependency nicht gefunden: ${depId}`
              });
            }
          }
        }
      }

      // ========================================
      // 6. SPECS VALIDIEREN
      // ========================================

      // Specs gegen ersten Layer validieren (primärer Lookup)
      const primaryLayer = layers[0];
      const specsResult = validateSpecs(specs, primaryLayer);
      if (!specsResult.ok) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: `Specs-Validierung fehlgeschlagen: ${specsResult.error.message}`,
          details: specsResult.error
        });
      }

      // Spec-Pfade extrahieren für zusätzliche Doc-Speicherung
      const specFilePaths = specsResult.value.specs.map(s => s.filePath);

      // ========================================
      // 7. IMPL VALIDIEREN
      // ========================================

      const implResult = validateImpls(impl);
      if (!implResult.ok) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: `Impl-Validierung fehlgeschlagen: ${implResult.error.message}`,
          details: implResult.error
        });
      }

      // Source-Pfade extrahieren (nur existierende Dateien, d.h. [ändern]/[fertig])
      const sourcePaths = implResult.value.impls
        .filter(i => i.filePath) // null für [neu]
        .map(i => i.filePath);

      // ========================================
      // 8. TASK ERSTELLEN
      // ========================================

      // Doc-Pfade: Location-Docs + Spec-Docs (dedupliziert)
      // Pfade normalisieren: relativ zu docs/ (Adapter erwartet z.B. "domain/Creature.md")
      const allDocPaths = [...new Set([...docs, ...specFilePaths])];
      const relativeDocPaths = allDocPaths.map(d => d.replace(/^docs\//, ''));

      const result = taskAdapter.addTask({
        domain: domains.join(', '),
        layer: layers.join(', '),
        beschreibung: normalizedBeschreibung,
        prio: prio || 'mittel',
        mvp: mvp || 'Nein',
        deps: parsedDeps,
        spec: specs,
        impl,
        isBug: false
      }, {
        dryRun,
        init,
        docPaths: relativeDocPaths,
        sourcePaths
      });

      if (!result.ok) {
        return result;
      }

      return ok({
        success: true,
        taskId: result.value.newId,
        line: result.value.line,
        docs: allDocPaths,
        sources: sourcePaths,
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
    tasks: null,   // JSON-Array für Tasks
    bugs: null,    // JSON-Array für Bugs
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--tasks') {
      opts.tasks = argv[++i];
    } else if (arg === '--bugs') {
      opts.bugs = argv[++i];
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
 *
 * Nur JSON-Modus: --tasks oder --bugs
 */
export function execute(opts, service = null) {
  const addService = service ?? createAddService();

  if (opts.tasks) {
    return executeBulkTasks(opts.tasks, addService, opts);
  }
  if (opts.bugs) {
    return executeBulkBugs(opts.bugs, addService, opts);
  }

  return err({
    code: TaskErrorCode.INVALID_FORMAT,
    message: '--tasks oder --bugs erforderlich (JSON-Array)'
  });
}

/**
 * Führt Bulk-Add für Tasks aus
 *
 * Pflichtfelder im JSON:
 * - domain, layer, beschreibung, deps, specs, impl
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

  const requiredFields = ['domain', 'layer', 'beschreibung', 'deps', 'specs', 'impl'];

  for (let i = 0; i < tasks.length; i++) {
    const taskData = tasks[i];
    const taskIndex = i + 1;

    // Pflichtfelder prüfen
    let missingField = null;
    for (const field of requiredFields) {
      if (!taskData[field] || (typeof taskData[field] === 'string' && taskData[field].trim() === '')) {
        missingField = field;
        break;
      }
    }

    if (missingField) {
      results.failed.push({
        taskIndex,
        error: { message: `${missingField} fehlt` }
      });
      continue;
    }

    // addTask aufrufen
    const result = addService.addTask({
      domain: taskData.domain,
      layer: taskData.layer,
      beschreibung: taskData.beschreibung,
      prio: taskData.prio,
      mvp: taskData.mvp,
      deps: taskData.deps,
      specs: taskData.specs,
      impl: taskData.impl
    }, {
      dryRun: globalOpts.dryRun,
      init: taskData.init ?? false
    });

    if (result.ok) {
      results.success.push({
        taskId: result.value.taskId,
        docs: result.value.docs,
        sources: result.value.sources,
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
Add Command - Neue Task(s) oder Bug(s) erstellen

USAGE:
  node scripts/task.mjs add --tasks '<JSON-Array>'
  node scripts/task.mjs add --bugs '<JSON-Array>'

COMMANDS:
  --tasks '<JSON>'       Tasks erstellen (JSON-Array, auch für einzelne)
  --bugs '<JSON>'        Bugs erstellen (JSON-Array, auch für einzelne)

ALLGEMEIN:
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

IMPL-TAGS:
  [neu]                  Noch zu erstellen (nur Format geprüft)
  [ändern]               Bestehendes ändern (Datei + Funktion muss existieren)
  [fertig]               Bereits implementiert (Datei + Funktion muss existieren)

BEISPIELE:
  # Einzelne Task erstellen
  node scripts/task.mjs add --tasks '[{
    "domain": "Travel",
    "layer": "features",
    "beschreibung": "Route-Validierung implementieren",
    "deps": "#100, #101",
    "specs": "Travel.md#Zustände",
    "impl": "travel-engine.ts.validateRoute() [neu]"
  }]'

  # Mehrere Tasks auf einmal
  node scripts/task.mjs add --tasks '[
    {
      "domain": "Travel",
      "layer": "features",
      "beschreibung": "Task A",
      "deps": "-",
      "specs": "Travel.md#API",
      "impl": "travel.ts.start() [neu]"
    },
    {
      "domain": "Map",
      "layer": "data",
      "beschreibung": "Task B",
      "deps": "#100",
      "specs": "Map.md#Rendering",
      "impl": "map.ts.render() [ändern]",
      "prio": "hoch"
    }
  ]'

  # Bug erstellen
  node scripts/task.mjs add --bugs '[{"beschreibung": "Login funktioniert nicht", "deps": "#428"}]'

  # Mehrere Bugs auf einmal
  node scripts/task.mjs add --bugs '[
    {"beschreibung": "Bug A", "prio": "hoch", "deps": "#428"},
    {"beschreibung": "Bug B"}
  ]'

JSON-SCHEMA (Task):
  {
    "domain": "...",        // erforderlich - Multi via ","
    "layer": "...",         // erforderlich - Multi via ","
    "beschreibung": "...",  // erforderlich
    "deps": "...",          // erforderlich ("-" wenn keine)
    "specs": "...",         // erforderlich (datei.md#abschnitt)
    "impl": "...",          // erforderlich (datei.ts.funktion() [tag])
    "prio": "...",          // optional, default: mittel
    "mvp": "Ja|Nein",       // optional, default: Nein
    "init": true|false      // optional, default: false
  }

JSON-SCHEMA (Bug):
  {
    "beschreibung": "...",  // erforderlich
    "prio": "...",          // optional, default: hoch
    "deps": "#428"          // optional (betroffene Tasks)
  }

SPEICHERORT-AUFLÖSUNG:
  Der Speicherort wird automatisch aus Domain+Layer ermittelt:
  - features:     docs/features/{Domain}.md oder docs/features/{domain}/{Domain}.md
  - data:         docs/entities/{Domain}.md
  - views:        docs/views/{Domain}.md
  - infra:        docs/infra/{Domain}.md

  Bei Multi-Domain/Layer: Mindestens ein Match pro Layer erforderlich.

VALIDIERUNG:
  - deps: Referenzierte IDs müssen in der Roadmap existieren
  - specs: Datei und Abschnitt (## oder ###) müssen existieren
  - impl [ändern]/[fertig]: Datei und Funktion müssen in src/ existieren
  - beschreibung: Wird normalisiert (Pipes, Newlines, etc. escaped)

HINWEISE:
  - Tasks werden in Roadmap + allen aufgelösten Docs gespeichert
  - Bugs werden nur in der Roadmap gespeichert
  - Partial Success: Fehlerhafte Items stoppen nicht die anderen
`;
}

/**
 * Default Add-Service Instanz
 */
export const defaultAddService = createAddService();
