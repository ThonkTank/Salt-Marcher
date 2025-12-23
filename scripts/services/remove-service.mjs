/**
 * Remove Service
 *
 * Löscht Tasks und Bugs, löst Bugs auf.
 * Nutzt den TaskAdapter für automatische Synchronisation.
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { TaskStatus } from '../core/table/schema.mjs';
import { parseTaskId, parseDeps, formatId, formatDeps } from '../core/table/parser.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';

/**
 * Erstellt einen Remove-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @returns {object}
 */
export function createRemoveService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();

  /**
   * Findet alle Items die eine ID referenzieren
   */
  function findReferencingItems(targetId, roadmapData) {
    const results = [];
    const targetStr = String(targetId);

    for (const task of roadmapData.tasks) {
      const refs = parseDeps(task.depsRaw ?? '-');
      if (refs.some(r => String(r) === targetStr)) {
        results.push({ ...task, type: 'task' });
      }
    }

    for (const bug of roadmapData.bugs) {
      const refs = parseDeps(bug.depsRaw ?? '-');
      if (refs.some(r => String(r) === targetStr)) {
        results.push({ ...bug, type: 'bug' });
      }
    }

    return results;
  }

  return {
    /**
     * Löscht eine Task
     */
    deleteTask(taskId, opts = {}) {
      const { dryRun = false } = opts;

      const loadResult = taskAdapter.load();
      if (!loadResult.ok) {
        return loadResult;
      }

      const roadmapData = loadResult.value;
      const task = roadmapData.itemMap.get(taskId);

      if (!task || task.isBug) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Task ${formatId(taskId)} nicht gefunden`
        });
      }

      const taskIdStr = String(taskId);

      // Referenzierende Items finden und Deps bereinigen
      const referencingItems = findReferencingItems(taskId, roadmapData);
      const affectedItems = [];

      if (!dryRun) {
        for (const item of referencingItems) {
          const refs = parseDeps(item.depsRaw ?? '-');
          const newRefs = refs.filter(r => String(r) !== taskIdStr);
          const newDeps = formatDeps(newRefs);

          // Via Adapter aktualisieren (automatische Sync)
          const updateResult = taskAdapter.updateTask(item.number, { deps: newDeps });

          if (updateResult.ok) {
            affectedItems.push({
              id: item.number,
              type: item.isBug ? 'bug' : 'task',
              oldDeps: item.depsRaw,
              newDeps,
              docs: updateResult.value.docs
            });
          }
        }
      } else {
        // Dry-run: Nur sammeln was betroffen wäre
        for (const item of referencingItems) {
          const refs = parseDeps(item.depsRaw ?? '-');
          const newRefs = refs.filter(r => String(r) !== taskIdStr);
          const newDeps = formatDeps(newRefs);

          affectedItems.push({
            id: item.number,
            type: item.isBug ? 'bug' : 'task',
            oldDeps: item.depsRaw,
            newDeps
          });
        }
      }

      // Task löschen via Adapter (Roadmap + Docs)
      const deleteResult = taskAdapter.deleteTask(taskId, { dryRun });

      if (!deleteResult.ok) {
        return deleteResult;
      }

      return ok({
        success: true,
        taskId,
        deletedLine: task.originalLine,
        affectedItems,
        docs: deleteResult.value.docs,
        dryRun
      });
    },

    /**
     * Löscht einen Bug
     */
    deleteBug(bugId, opts = {}) {
      const { dryRun = false } = opts;

      const loadResult = taskAdapter.load();
      if (!loadResult.ok) {
        return loadResult;
      }

      const roadmapData = loadResult.value;
      const bug = roadmapData.bugs.find(b => b.number === bugId);

      if (!bug) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Bug ${bugId} nicht gefunden`
        });
      }

      // Bug aus Task-Deps entfernen
      const affectedTasks = [];

      if (!dryRun) {
        for (const task of roadmapData.tasks) {
          const refs = parseDeps(task.depsRaw ?? '-');
          if (refs.includes(bugId)) {
            const newRefs = refs.filter(r => r !== bugId);
            const newDeps = formatDeps(newRefs);

            // Via Adapter aktualisieren (automatische Sync)
            const updateResult = taskAdapter.updateTask(task.number, { deps: newDeps });

            if (updateResult.ok) {
              affectedTasks.push({
                taskId: task.number,
                oldDeps: task.depsRaw,
                newDeps,
                status: task.status,
                docs: updateResult.value.docs
              });
            }
          }
        }
      } else {
        // Dry-run: Nur sammeln was betroffen wäre
        for (const task of roadmapData.tasks) {
          const refs = parseDeps(task.depsRaw ?? '-');
          if (refs.includes(bugId)) {
            const newRefs = refs.filter(r => r !== bugId);
            const newDeps = formatDeps(newRefs);

            affectedTasks.push({
              taskId: task.number,
              oldDeps: task.depsRaw,
              newDeps,
              status: task.status
            });
          }
        }
      }

      // Bug löschen via Adapter
      const deleteResult = taskAdapter.deleteTask(bugId, { dryRun });

      if (!deleteResult.ok) {
        return deleteResult;
      }

      return ok({
        success: true,
        bugId,
        deletedLine: bug.originalLine,
        affectedTasks,
        dryRun
      });
    },

    /**
     * Löst einen Bug (Status auf DONE, entfernt aus Task-Deps)
     */
    resolveBug(bugId, opts = {}) {
      const { dryRun = false } = opts;

      const loadResult = taskAdapter.load();
      if (!loadResult.ok) {
        return loadResult;
      }

      const roadmapData = loadResult.value;
      const bug = roadmapData.bugs.find(b => b.number === bugId);

      if (!bug) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Bug ${bugId} nicht gefunden`
        });
      }

      if (bug.status === TaskStatus.DONE) {
        return err({
          code: TaskErrorCode.ALREADY_DONE,
          message: `Bug ${bugId} ist bereits gelöst`
        });
      }

      // Bug-Status via Adapter aktualisieren
      const bugUpdateResult = taskAdapter.updateTask(bugId, { status: TaskStatus.DONE }, { dryRun });

      if (!bugUpdateResult.ok) {
        return bugUpdateResult;
      }

      // Bug aus Task-Deps entfernen
      const affectedTasks = [];

      if (!dryRun) {
        for (const task of roadmapData.tasks) {
          const refs = parseDeps(task.depsRaw ?? '-');
          if (refs.includes(bugId)) {
            const newRefs = refs.filter(r => r !== bugId);
            const newDeps = formatDeps(newRefs);

            // Via Adapter aktualisieren (automatische Sync)
            const updateResult = taskAdapter.updateTask(task.number, { deps: newDeps });

            if (updateResult.ok) {
              affectedTasks.push({
                taskId: task.number,
                oldDeps: task.depsRaw,
                newDeps,
                status: task.status,
                docs: updateResult.value.docs
              });
            }
          }
        }
      } else {
        // Dry-run: Nur sammeln was betroffen wäre
        for (const task of roadmapData.tasks) {
          const refs = parseDeps(task.depsRaw ?? '-');
          if (refs.includes(bugId)) {
            const newRefs = refs.filter(r => r !== bugId);
            const newDeps = formatDeps(newRefs);

            affectedTasks.push({
              taskId: task.number,
              oldDeps: task.depsRaw,
              newDeps,
              status: task.status
            });
          }
        }
      }

      return ok({
        success: true,
        bugId,
        oldStatus: bug.status,
        newStatus: TaskStatus.DONE,
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
 * Parst CLI-Argumente für remove command
 */
export function parseArgs(argv) {
  const opts = {
    itemId: null,
    resolve: false,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--resolve' || arg === '-r') {
      opts.resolve = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      if (arg.match(/^b\d+$/)) {
        opts.itemId = arg;
        opts.isBug = true;
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) {
          opts.itemId = parsed;
          opts.isBug = false;
        }
      }
    }
  }

  return opts;
}

/**
 * Führt den remove command aus
 */
export function execute(opts, service = null) {
  const removeService = service ?? createRemoveService();

  if (!opts.itemId) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Task-ID oder Bug-ID erforderlich'
    });
  }

  if (opts.isBug) {
    if (opts.resolve) {
      return removeService.resolveBug(opts.itemId, { dryRun: opts.dryRun });
    }
    return removeService.deleteBug(opts.itemId, { dryRun: opts.dryRun });
  }

  return removeService.deleteTask(opts.itemId, { dryRun: opts.dryRun });
}

/**
 * Zeigt Hilfe für remove command
 */
export function showHelp() {
  return `
Remove Command - Task oder Bug löschen/lösen

USAGE:
  node scripts/task.mjs remove <ID> [OPTIONS]

ARGUMENTE:
  <ID>                   Task-ID (z.B. 428, #428) oder Bug-ID (z.B. b4)

OPTIONEN:
  -r, --resolve          Bug als gelöst markieren (statt löschen)
                         Setzt Status auf DONE und entfernt Bug aus Task-Deps
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

VERHALTEN:
  Task löschen:
  - Entfernt Task-Zeile aus der Roadmap
  - Bereinigt Deps in referenzierenden Tasks/Bugs
  - Entfernt Task aus Feature-Docs (automatisch)

  Bug löschen:
  - Entfernt Bug-Zeile aus der Roadmap
  - Bereinigt Deps in referenzierenden Tasks (automatisch synchronisiert)

  Bug lösen (--resolve):
  - Setzt Bug-Status auf DONE
  - Entfernt Bug aus Task-Deps (automatisch synchronisiert)
  - Behält Bug-Zeile in der Roadmap

BEISPIELE:
  node scripts/task.mjs remove 428           # Task #428 löschen
  node scripts/task.mjs remove b4            # Bug b4 löschen
  node scripts/task.mjs remove b4 --resolve  # Bug b4 als gelöst markieren
  node scripts/task.mjs remove 428 --dry-run # Vorschau
`;
}

/**
 * Default Remove-Service Instanz
 */
export const defaultRemoveService = createRemoveService();
