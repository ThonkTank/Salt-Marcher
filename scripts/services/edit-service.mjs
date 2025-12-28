/**
 * Edit Service
 *
 * Orchestriert Task-Updates mit Validierung, Claim-Handling und Propagation.
 * Nutzt den TaskAdapter für automatische Synchronisation (Roadmap + Docs).
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { TaskStatus, VALID_STATUSES, resolveStatusAlias } from '../core/table/schema.mjs';
import { parseTaskId, parseDeps, formatId, isBugId } from '../core/table/parser.mjs';
import { normalizeId, areDepsResolved } from '../core/task/types.mjs';
import { calculateAllPropagation } from '../core/deps/propagation.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { checkKey, handleStatusChange } from './claim-service.mjs';

/**
 * @typedef {object} UpdateResult
 * @property {boolean} success
 * @property {object} roadmap - Roadmap-Änderungen
 * @property {object[]} docs - Doc-Änderungen
 * @property {object|null} claim - Claim-Ergebnis
 * @property {object[]} propagation - Propagierte Status-Änderungen
 * @property {string[]} errors
 */

/**
 * Erstellt einen Edit-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @returns {object}
 */
export function createTaskService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();

  return {
    /**
     * Aktualisiert eine Task oder Bug
     *
     * Der Adapter kümmert sich automatisch um:
     * - Roadmap-Änderung
     * - Synchronisation zu allen Feature-Docs
     *
     * Bei geclaimed Tasks muss der Key übergeben werden.
     */
    updateTask(taskId, updates, opts = {}) {
      const { dryRun = false, key = null } = opts;
      const result = {
        success: false,
        roadmap: { modified: false, before: null, after: null, statusChange: null },
        docs: [],
        propagation: [],
        errors: []
      };

      // 1. Roadmap laden für Validierung
      const loadResult = taskAdapter.load();
      if (!loadResult.ok) {
        return loadResult;
      }

      const roadmapData = loadResult.value;
      const item = roadmapData.itemMap.get(taskId);

      if (!item) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Task ${formatId(taskId)} nicht in Roadmap gefunden`
        });
      }

      result.item = item;
      result.originalStatus = item.status;

      // 2. Key-Check: Wenn Task geclaimed ist, muss Key stimmen
      if (!checkKey(taskId, key)) {
        return err({
          code: TaskErrorCode.CLAIM_REQUIRED,
          message: `Task ${formatId(taskId)} ist geclaimed. --key erforderlich.`
        });
      }

      // 3. Status validieren (Alias auflösen)
      if (updates.status) {
        updates.status = resolveStatusAlias(updates.status);
        if (!VALID_STATUSES.includes(updates.status)) {
          return err({
            code: TaskErrorCode.INVALID_STATUS,
            message: `Ungültiger Status: ${updates.status}. Gültig: ${VALID_STATUSES.join(', ')}`
          });
        }
      }

      // 3a. Bug-Dependency-Validierung: Wenn Status auf ✅, Bugs prüfen
      if (updates.status === TaskStatus.DONE && !item.isBug) {
        const unresolvedBugs = (item.deps || [])
          .filter(depId => isBugId(depId))
          .filter(depId => {
            const bugItem = roadmapData.itemMap.get(depId);
            return bugItem && bugItem.status !== TaskStatus.DONE;
          });

        if (unresolvedBugs.length > 0) {
          return err({
            code: TaskErrorCode.UNRESOLVED_BUG_DEPS,
            message: `Task kann nicht auf ✅ gesetzt werden: ${unresolvedBugs.map(formatId).join(', ')} noch nicht gelöst`
          });
        }
      }

      // 4. Deps validieren
      if (updates.deps && updates.deps !== '-') {
        const depIds = parseDeps(updates.deps);
        for (const depId of depIds) {
          if (normalizeId(depId) === normalizeId(taskId)) {
            return err({
              code: TaskErrorCode.CIRCULAR_DEPENDENCY,
              message: 'Task kann nicht von sich selbst abhängen'
            });
          }
          if (!roadmapData.itemMap.has(depId)) {
            result.errors.push(`Dependency ${formatId(depId)} nicht gefunden`);
          }
        }
      }

      if (result.errors.length > 0) {
        return err({
          code: TaskErrorCode.INVALID_DEPS,
          message: result.errors.join(', ')
        });
      }

      // 4. Status-Änderung entfernt Claim automatisch (nur bei echtem Update)
      if (!dryRun && updates.status && updates.status !== TaskStatus.CLAIMED) {
        handleStatusChange(taskId, updates.status);
      }

      // 5. Prüfen ob Änderungen vorliegen
      const hasChanges = Object.keys(updates).some(k => updates[k] !== undefined);

      if (!hasChanges) {
        result.success = true;
        return ok(result);
      }

      // 6. Task aktualisieren via Adapter (Roadmap + Docs automatisch)
      const updateResult = taskAdapter.updateTask(taskId, updates, { dryRun });
      if (!updateResult.ok) {
        return updateResult;
      }

      result.roadmap = updateResult.value.roadmap;
      result.docs = updateResult.value.docs;
      result.roadmap.statusChange = updates.status
        ? { from: item.status, to: updates.status }
        : null;

      // 7. Status-Propagation (wenn Status geändert und keine Bug)
      if (updates.status && !item.isBug && !dryRun) {
        // ItemMap für Propagation aktualisieren
        if (roadmapData.itemMap.has(taskId)) {
          roadmapData.itemMap.get(taskId).status = updates.status;
        }

        const allItems = [...roadmapData.tasks, ...roadmapData.bugs];
        const effects = calculateAllPropagation(
          taskId,
          updates.status,
          allItems,
          roadmapData.itemMap
        );

        if (effects.length > 0) {
          // Propagierte Tasks auch via Adapter aktualisieren (automatische Sync)
          for (const effect of effects) {
            const propResult = taskAdapter.updateTask(
              effect.taskId,
              { status: effect.newStatus },
              { dryRun }
            );

            if (propResult.ok) {
              result.propagation.push({
                id: effect.taskId,
                oldStatus: effect.oldStatus,
                newStatus: effect.newStatus,
                reason: effect.reason,
                docs: propResult.value.docs
              });
            }
          }
        }
      }

      // 8. Self-Check bei Dependency-Änderungen (✅ Task bekommt nicht-✅ Dep → 🔶)
      if (updates.deps !== undefined && !item.isBug && !dryRun) {
        // ItemMap aktualisieren mit neuen Dependencies
        const updatedItem = roadmapData.itemMap.get(taskId);
        if (updatedItem) {
          // Deps parsen und in ItemMap aktualisieren
          if (updates.deps === '-') {
            updatedItem.deps = [];
          } else {
            updatedItem.deps = parseDeps(updates.deps);
          }

          // Prüfen ob Task ✅ ist und Deps nicht erfüllt
          if (updatedItem.status === TaskStatus.DONE) {
            if (!areDepsResolved(updatedItem, roadmapData.itemMap)) {
              // Task selbst auf 🔶 setzen
              const selfResult = taskAdapter.updateTask(taskId, { status: TaskStatus.PARTIAL }, { dryRun });
              if (selfResult.ok) {
                result.propagation.push({
                  id: taskId,
                  oldStatus: TaskStatus.DONE,
                  newStatus: TaskStatus.PARTIAL,
                  reason: 'Neue Dependency ist nicht erfüllt',
                  docs: selfResult.value.docs
                });
              }
            }
          }
        }
      }

      result.success = true;
      result.dryRun = dryRun;
      return ok(result);
    },

    /**
     * Aktualisiert den Blockiert-Status aller Tasks
     */
    refreshBlocked(opts = {}) {
      const { dryRun = false } = opts;

      const loadResult = taskAdapter.load();
      if (!loadResult.ok) {
        return loadResult;
      }

      const roadmapData = loadResult.value;
      const changes = [];

      for (const task of roadmapData.tasks) {
        // Fertige Tasks überspringen
        if (task.status === TaskStatus.DONE) continue;

        // Prüfen ob alle Dependencies erfüllt sind
        const depsResolved = task.deps.every(depId => {
          const dep = roadmapData.itemMap.get(depId);
          return dep && dep.status === TaskStatus.DONE;
        });

        const shouldBeBlocked = task.deps.length > 0 && !depsResolved;

        if (shouldBeBlocked && task.status !== TaskStatus.BLOCKED) {
          // Task sollte blockiert sein
          if (!dryRun) {
            taskAdapter.updateTask(task.number, { status: TaskStatus.BLOCKED });
          }
          changes.push({
            id: task.number,
            oldStatus: task.status,
            newStatus: TaskStatus.BLOCKED
          });
        } else if (!shouldBeBlocked && task.status === TaskStatus.BLOCKED) {
          // Task sollte nicht mehr blockiert sein
          if (!dryRun) {
            taskAdapter.updateTask(task.number, { status: TaskStatus.OPEN });
          }
          changes.push({
            id: task.number,
            oldStatus: TaskStatus.BLOCKED,
            newStatus: TaskStatus.OPEN
          });
        }
      }

      return ok({
        success: true,
        changes,
        dryRun
      });
    }
  };
}

/**
 * Default Task-Service Instanz
 */
export const defaultTaskService = createTaskService();

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Parst CLI-Argumente für edit command
 */
export function parseArgs(argv) {
  const opts = {
    taskIds: [],    // Array für 1+ IDs
    keys: [],       // Array für Keys (Zuordnung nach Reihenfolge)
    status: null,
    deps: null,
    beschreibung: null,
    domain: null,
    prio: null,
    mvp: null,
    spec: null,
    imp: null,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--status' || arg === '-s') {
      opts.status = argv[++i];
    } else if (arg === '--deps' || arg === '-d') {
      opts.deps = argv[++i];
    } else if (arg === '--no-deps') {
      opts.deps = '-';
    } else if (arg === '--beschreibung' || arg === '-m') {
      opts.beschreibung = argv[++i];
    } else if (arg === '--domain' || arg === '-b') {
      opts.domain = argv[++i];
    } else if (arg === '--layer' || arg === '-l') {
      opts.layer = argv[++i];
    } else if (arg === '--prio' || arg === '-p') {
      opts.prio = argv[++i];
    } else if (arg === '--mvp') {
      opts.mvp = argv[++i];
    } else if (arg === '--spec') {
      opts.spec = argv[++i];
    } else if (arg === '--imp' || arg === '--impl') {
      opts.imp = argv[++i];
    } else if (arg === '--key' || arg === '-k') {
      opts.keys.push(argv[++i]);
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      // IDs sammeln (Tasks und Bugs)
      if (arg.match(/^b\d+$/)) {
        opts.taskIds.push(arg);
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) opts.taskIds.push(parsed);
      }
    }
  }

  return opts;
}

/**
 * Führt den edit command aus
 *
 * - 1 ID: Single-Mode (Rückgabe wie bisher)
 * - 2+ IDs: Bulk-Mode (Rückgabe: {success, failed, propagation})
 */
export function execute(opts, service = null) {
  const editService = service ?? createTaskService();

  if (opts.taskIds.length === 0) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Mindestens eine Task-ID oder Bug-ID erforderlich'
    });
  }

  // Updates-Objekt bauen
  const updates = {};
  if (opts.status) updates.status = opts.status;
  if (opts.deps !== null) updates.deps = opts.deps;
  if (opts.beschreibung) {
    updates.beschreibung = opts.beschreibung.replace(/[\r\n]+/g, ' ').trim();
  }
  if (opts.domain) updates.domain = opts.domain;
  if (opts.layer) updates.layer = opts.layer;
  if (opts.prio) updates.prio = opts.prio;
  if (opts.mvp) updates.mvp = opts.mvp;
  if (opts.spec) updates.spec = opts.spec;
  if (opts.imp) updates.imp = opts.imp;

  // Single-Mode: 1 ID → direktes Ergebnis
  if (opts.taskIds.length === 1) {
    const key = opts.keys[0] ?? null;
    return editService.updateTask(opts.taskIds[0], updates, {
      dryRun: opts.dryRun,
      key
    });
  }

  // Bulk-Mode: 2+ IDs → Partial Success
  const availableKeys = [...opts.keys];
  const results = {
    success: [],
    failed: [],
    propagation: [],
    dryRun: opts.dryRun
  };

  for (const taskId of opts.taskIds) {
    const key = availableKeys.shift() ?? null;

    const result = editService.updateTask(taskId, { ...updates }, {
      dryRun: opts.dryRun,
      key
    });

    if (result.ok) {
      results.success.push({
        taskId,
        statusChange: result.value.roadmap?.statusChange ?? null
      });
      if (result.value.propagation?.length > 0) {
        results.propagation.push(...result.value.propagation);
      }
    } else {
      results.failed.push({
        taskId,
        error: result.error
      });
    }
  }

  return ok(results);
}

/**
 * Zeigt Hilfe für edit command
 */
export function showHelp() {
  return `
Edit Command - Tasks oder Bugs bearbeiten (1 oder mehrere)

USAGE:
  node scripts/task.mjs edit <ID> [ID...] [OPTIONS]

ARGUMENTE:
  <ID> [ID...]           Eine oder mehrere Task-IDs (z.B. 428, #428) oder Bug-IDs (z.B. b4)

OPTIONEN:
  -s, --status <status>  Status ändern (⬜, ✅, ⚠️, 🔶, 🔒, 📋, ⛔)
  -d, --deps "<deps>"    Dependencies setzen (z.B. "#100, #202, b4")
  --no-deps              Dependencies entfernen (setzt auf "-")
  -m, --beschreibung "." Beschreibung ändern
  -b, --domain <name>    Domain ändern (z.B. Travel, Map)
  -l, --layer <layer>    Layer ändern (core, features, infra, apps)
  -p, --prio <prio>      Priorität ändern (hoch, mittel, niedrig)
  --mvp <Ja|Nein>        MVP-Status ändern
  --spec "File.md#..."   Spec-Referenz ändern
  --imp "file:func()"    Implementierungs-Details ändern

CLAIM-HANDLING:
  -k, --key <key>        Key für geclaime Tasks (kann mehrfach angegeben werden)
                         Keys werden in Reihenfolge den Task-IDs zugeordnet

ALLGEMEIN:
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

BEISPIELE (Einzeln):
  node scripts/task.mjs edit 428 --status ✅
  node scripts/task.mjs edit 428 --status ✅ --key a4x2
  node scripts/task.mjs edit 428 --deps "#100, #202"
  node scripts/task.mjs edit b4 --status ✅

BEISPIELE (Mehrere):
  node scripts/task.mjs edit 100 101 102 --status ✅
  node scripts/task.mjs edit 100 101 --status 🟢 --key a4x2 --key b5y3
  node scripts/task.mjs edit 100 101 102 --prio hoch --dry-run

HINWEISE:
  - Bei mehreren IDs: Fehlerhafte Tasks verhindern nicht die Bearbeitung der anderen
  - Keys werden in der angegebenen Reihenfolge den Tasks zugeordnet
`;
}
