/**
 * Edit Service
 *
 * Orchestriert Task-Updates mit Validierung, Claim-Handling und Propagation.
 * Nutzt den TaskAdapter für automatische Synchronisation (Roadmap + Docs).
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { TaskStatus, VALID_STATUSES } from '../core/table/schema.mjs';
import { parseTaskId, parseDeps, formatId } from '../core/table/parser.mjs';
import { normalizeId } from '../core/task/types.mjs';
import { calculateAllPropagation } from '../core/deps/propagation.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { createClaimService } from './claim-service.mjs';

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
 * @param {import('./claim-service.mjs').ClaimService} [options.claimService] - Claim-Service
 * @returns {object}
 */
export function createTaskService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();
  const claimService = options.claimService ?? createClaimService();

  return {
    /**
     * Aktualisiert eine Task oder Bug
     *
     * Der Adapter kümmert sich automatisch um:
     * - Roadmap-Änderung
     * - Synchronisation zu allen Feature-Docs
     */
    updateTask(taskId, updates, opts = {}) {
      const { dryRun = false, agentId = null } = opts;
      const result = {
        success: false,
        roadmap: { modified: false, before: null, after: null, statusChange: null },
        docs: [],
        claim: null,
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

      // 2. Status validieren
      if (updates.status && !VALID_STATUSES.includes(updates.status)) {
        return err({
          code: TaskErrorCode.INVALID_STATUS,
          message: `Ungültiger Status: ${updates.status}. Gültig: ${VALID_STATUSES.join(', ')}`
        });
      }

      // 3. Deps validieren
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

      // 4. Claim-Handling
      const myId = claimService.getAgentId(agentId);

      if (updates.claim) {
        const claimResult = claimService.claim(taskId, myId);
        if (!claimResult.ok) {
          return claimResult;
        }
        result.claim = claimResult.value;
        if (claimResult.value.action === 'claimed') {
          updates.status = TaskStatus.CLAIMED;
        }
      }

      if (updates.unclaim) {
        const unclaimResult = claimService.unclaim(taskId, myId);
        if (!unclaimResult.ok) {
          return unclaimResult;
        }
        result.claim = unclaimResult.value;
        if (!updates.status) {
          updates.status = TaskStatus.OPEN;
        }
      }

      // Status-Änderung entfernt Claim
      if (updates.status && updates.status !== TaskStatus.CLAIMED) {
        const handleResult = claimService.handleStatusChange(taskId, updates.status);
        if (handleResult.ok && handleResult.value) {
          result.claim = handleResult.value;
        }
      }

      // 5. Prüfen ob Änderungen vorliegen
      const hasChanges = Object.keys(updates).some(key =>
        !['claim', 'unclaim'].includes(key) && updates[key] !== undefined
      );

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
    },

    /**
     * Prüft Claim-Status einer Task
     */
    checkClaim(taskId, agentId = null) {
      return claimService.checkClaim(taskId, agentId);
    },

    /**
     * Gibt die Agent-ID zurück
     */
    getAgentId(cliAgentId = null) {
      return claimService.getAgentId(cliAgentId);
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
    taskId: null,
    status: null,
    deps: null,
    beschreibung: null,
    bereich: null,
    prio: null,
    mvp: null,
    spec: null,
    imp: null,
    agentId: null,
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
    } else if (arg === '--bereich' || arg === '-b') {
      opts.bereich = argv[++i];
    } else if (arg === '--prio' || arg === '-p') {
      opts.prio = argv[++i];
    } else if (arg === '--mvp') {
      opts.mvp = argv[++i];
    } else if (arg === '--spec') {
      opts.spec = argv[++i];
    } else if (arg === '--imp') {
      opts.imp = argv[++i];
    } else if (arg === '--agent-id') {
      opts.agentId = argv[++i];
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      // ID parsen
      if (arg.match(/^b\d+$/)) {
        opts.taskId = arg;
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) opts.taskId = parsed;
      }
    }
  }

  return opts;
}

/**
 * Führt den edit command aus
 */
export function execute(opts, service = null) {
  const editService = service ?? createTaskService();

  if (!opts.taskId) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Task-ID oder Bug-ID erforderlich'
    });
  }

  const updates = {};
  if (opts.status) updates.status = opts.status;
  if (opts.deps !== null) updates.deps = opts.deps;
  if (opts.beschreibung) updates.beschreibung = opts.beschreibung;
  if (opts.bereich) updates.bereich = opts.bereich;
  if (opts.prio) updates.prio = opts.prio;
  if (opts.mvp) updates.mvp = opts.mvp;
  if (opts.spec) updates.spec = opts.spec;
  if (opts.imp) updates.imp = opts.imp;

  return editService.updateTask(opts.taskId, updates, {
    dryRun: opts.dryRun,
    agentId: opts.agentId
  });
}

/**
 * Zeigt Hilfe für edit command
 */
export function showHelp() {
  return `
Edit Command - Task oder Bug bearbeiten

USAGE:
  node scripts/task.mjs edit <ID> [OPTIONS]

ARGUMENTE:
  <ID>                   Task-ID (z.B. 428, #428, 428b) oder Bug-ID (z.B. b4)

OPTIONEN:
  -s, --status <status>  Status ändern (⬜, ✅, ⚠️, 🔶, 🔒, 📋, ⛔)
  -d, --deps "<deps>"    Dependencies setzen (z.B. "#100, #202, b4")
  --no-deps              Dependencies entfernen (setzt auf "-")
  -m, --beschreibung "." Beschreibung ändern
  -b, --bereich <name>   Bereich ändern (z.B. Travel, Map)
  -p, --prio <prio>      Priorität ändern (hoch, mittel, niedrig)
  --mvp <Ja|Nein>        MVP-Status ändern
  --spec "File.md#..."   Spec-Referenz ändern
  --imp "file:func()"    Implementierungs-Details ändern
  --agent-id <id>        Agent-ID für Claim-Operationen

ALLGEMEIN:
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task.mjs edit 428 --status ✅
  node scripts/task.mjs edit 428 --deps "#100, #202"
  node scripts/task.mjs edit 428 --beschreibung "Neue Beschreibung"
  node scripts/task.mjs edit b4 --status ✅
  node scripts/task.mjs edit 428 --status 🔶 --dry-run
`;
}
