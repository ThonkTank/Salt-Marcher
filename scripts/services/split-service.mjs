/**
 * Split Service
 *
 * Splittet Tasks in zwei Teile.
 * Nutzt den TaskAdapter für automatische Synchronisation.
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { parseTaskId, parseDeps, formatId } from '../core/table/parser.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';

/**
 * Erstellt einen Split-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @returns {object}
 */
export function createSplitService(options = {}) {
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
     * Splittet eine Task in zwei Teile
     */
    splitTask(taskId, partADesc, partBDesc, opts = {}) {
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

      // Warnung wenn andere Tasks diese referenzieren
      const referencingItems = findReferencingItems(taskId, roadmapData);

      // Split via Adapter (Roadmap + Docs automatisch)
      const splitResult = taskAdapter.splitTask(taskId, {
        descA: partADesc,
        descB: partBDesc
      }, { dryRun });

      if (!splitResult.ok) {
        return splitResult;
      }

      return ok({
        success: true,
        taskId,
        newIds: splitResult.value.newIds,
        lineA: splitResult.value.roadmap?.newLines?.[0],
        lineB: splitResult.value.roadmap?.newLines?.[1],
        referencingItems: referencingItems.map(i => ({
          id: i.number,
          type: i.isBug ? 'bug' : 'task'
        })),
        docs: splitResult.value.docs,
        dryRun
      });
    }
  };
}

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Parst CLI-Argumente für split command
 */
export function parseArgs(argv) {
  const opts = {
    taskId: null,
    partA: null,
    partB: null,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  // Positional args: ID, PartA, PartB
  if (positional.length >= 1) {
    const parsed = parseTaskId(positional[0]);
    if (parsed !== null) {
      opts.taskId = parsed;
    }
  }
  if (positional.length >= 2) {
    opts.partA = positional[1];
  }
  if (positional.length >= 3) {
    opts.partB = positional[2];
  }

  return opts;
}

/**
 * Führt den split command aus
 */
export function execute(opts, service = null) {
  const splitService = service ?? createSplitService();

  if (!opts.taskId) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Task-ID erforderlich'
    });
  }

  if (!opts.partA || !opts.partB) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Beschreibungen für Teil A und Teil B erforderlich'
    });
  }

  return splitService.splitTask(opts.taskId, opts.partA, opts.partB, { dryRun: opts.dryRun });
}

/**
 * Zeigt Hilfe für split command
 */
export function showHelp() {
  return `
Split Command - Task in zwei Teile splitten

USAGE:
  node scripts/task.mjs split <ID> "<Teil A>" "<Teil B>"

ARGUMENTE:
  <ID>                   Task-ID (z.B. 428, #428)
  "<Teil A>"             Beschreibung für Teil A (wird auf DONE gesetzt)
  "<Teil B>"             Beschreibung für Teil B (wird auf OPEN gesetzt)

OPTIONEN:
  -n, --dry-run          Vorschau ohne Speichern
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

VERHALTEN:
  - Ersetzt Task #X durch #Xa und #Xb
  - Teil A: Status DONE, behält Original-Deps
  - Teil B: Status OPEN, Dep auf #Xa
  - Warnt wenn andere Tasks #X referenzieren (müssen manuell angepasst werden)
  - Synchronisiert Feature-Docs automatisch

BEISPIELE:
  node scripts/task.mjs split 428 "API implementiert" "UI noch offen"
  node scripts/task.mjs split 428 "Schema fertig" "Tests ausstehend" --dry-run
`;
}

/**
 * Default Split-Service Instanz
 */
export const defaultSplitService = createSplitService();
