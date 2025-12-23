/**
 * Show Service
 *
 * Zeigt Task-Details mit Dependency- und Dependent-Trees an.
 * Für Keyword-Suche: sort command nutzen.
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { formatId } from '../core/table/parser.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { createClaimService } from './claim-service.mjs';

/**
 * @typedef {object} LookupResult
 * @property {object} item - Das gefundene Item
 * @property {object} [claim] - Claim-Info (falls geclaimed)
 * @property {Array<object>} [duplicates] - Duplikate (falls vorhanden)
 */

/**
 * @typedef {object} TreeNode
 * @property {string|number} number - Item-ID
 * @property {string} status - Status
 * @property {string} [beschreibung] - Beschreibung
 * @property {boolean} [isBug] - Bug-Flag
 * @property {boolean} [missing] - Fehlt in Roadmap
 * @property {TreeNode[]} children - Kind-Knoten
 */

/**
 * Erstellt einen Lookup-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @param {ReturnType<typeof createClaimService>} [options.claimService] - Claim-Service
 * @returns {LookupService}
 */
export function createLookupService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();
  const claimService = options.claimService ?? createClaimService();

  /**
   * Lädt alle Items (cached für Session)
   * @returns {import('../core/result.mjs').Result<{items: Array, itemMap: Map}>}
   */
  function loadData() {
    const loadResult = taskAdapter.load();
    if (!loadResult.ok) return loadResult;

    const { tasks, bugs, itemMap } = loadResult.value;
    const items = [...tasks, ...bugs];

    return ok({ items, itemMap, tasks, bugs });
  }

  return {
    /**
     * Holt eine einzelne Task/Bug mit Claim-Info
     *
     * @param {string|number} taskId - Task-ID oder Bug-ID
     * @param {string} [agentId] - Optionale Agent-ID für isMe-Check
     * @returns {import('../core/result.mjs').Result<LookupResult>}
     */
    getTask(taskId, agentId = null) {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { items, itemMap } = dataResult.value;
      const item = itemMap.get(taskId);

      if (!item) {
        return err({
          code: TaskErrorCode.NOT_FOUND,
          message: `${formatId(taskId)} nicht gefunden`
        });
      }

      const result = { item };

      // Duplikate prüfen
      const duplicates = items.filter(t => t.number === taskId);
      if (duplicates.length > 1) {
        result.duplicates = duplicates;
      }

      // Claim-Info holen
      if (item.status === '🔒') {
        const claimResult = claimService.checkClaim(taskId, agentId);
        if (claimResult.ok && claimResult.value.claimed) {
          result.claim = claimResult.value;
        }
      }

      return ok(result);
    },

    /**
     * Sucht Tasks nach Keyword
     *
     * @param {string} query - Suchbegriff
     * @param {object} [opts] - Optionen
     * @param {string} [opts.field] - 'bereich' | 'spec' | 'all' (default: 'all')
     * @param {number} [opts.limit] - Max. Ergebnisse (0 = alle)
     * @returns {import('../core/result.mjs').Result<Array>}
     */
    searchTasks(query, opts = {}) {
      const { field = 'all', limit = 0 } = opts;

      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { items } = dataResult.value;
      const keyword = query.toLowerCase();

      let results = items.filter(item => {
        if (field === 'bereich') {
          return item.bereich.toLowerCase().includes(keyword);
        }
        if (field === 'spec') {
          return (item.spec || '').toLowerCase().includes(keyword);
        }
        return (
          item.bereich.toLowerCase().includes(keyword) ||
          item.beschreibung.toLowerCase().includes(keyword) ||
          (item.spec || '').toLowerCase().includes(keyword)
        );
      });

      if (limit > 0 && results.length > limit) {
        results = results.slice(0, limit);
      }

      return ok(results);
    },

    /**
     * Findet direkte Dependents (Items die von diesem abhängen)
     *
     * @param {string|number} taskId - Task-ID
     * @returns {import('../core/result.mjs').Result<Array>}
     */
    findDependents(taskId) {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { items } = dataResult.value;
      const dependents = items.filter(t => t.deps.includes(taskId));

      return ok(dependents);
    },

    /**
     * Baut den Dependency-Baum (was muss vorher erledigt werden)
     *
     * @param {string|number} taskId - Task-ID
     * @param {number} [maxDepth=3] - Max. Tiefe
     * @returns {import('../core/result.mjs').Result<TreeNode>}
     */
    getDependencyTree(taskId, maxDepth = 3) {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { itemMap } = dataResult.value;

      function buildTree(id, depth, visited = new Set()) {
        if (depth > maxDepth || visited.has(id)) return null;
        visited.add(id);

        const item = itemMap.get(id);
        if (!item) {
          return { number: id, status: '?', missing: true, children: [], label: formatId(id) };
        }

        const children = item.deps
          .map(dep => buildTree(dep, depth + 1, visited))
          .filter(Boolean);

        return {
          number: item.number,
          status: item.status,
          beschreibung: item.beschreibung,
          isBug: item.isBug,
          children
        };
      }

      const tree = buildTree(taskId, 0);
      return ok(tree);
    },

    /**
     * Baut den Dependent-Baum (was wird hierdurch blockiert)
     *
     * @param {string|number} taskId - Task-ID
     * @param {number} [maxDepth=3] - Max. Tiefe
     * @returns {import('../core/result.mjs').Result<TreeNode>}
     */
    getDependentTree(taskId, maxDepth = 3) {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { items, itemMap } = dataResult.value;

      function buildTree(id, depth, visited = new Set()) {
        if (depth > maxDepth || visited.has(id)) return null;
        visited.add(id);

        const item = itemMap.get(id);
        if (!item) {
          return { number: id, status: '?', missing: true, children: [], label: formatId(id) };
        }

        const directDependents = items.filter(t => t.deps.includes(id));
        const children = directDependents
          .map(dep => buildTree(dep.number, depth + 1, visited))
          .filter(Boolean);

        return {
          number: item.number,
          status: item.status,
          beschreibung: item.beschreibung,
          isBug: item.isBug,
          children
        };
      }

      const tree = buildTree(taskId, 0);
      return ok(tree);
    },

    /**
     * Holt direkte Dependencies (resolved zu Items)
     *
     * @param {string|number} taskId - Task-ID
     * @returns {import('../core/result.mjs').Result<Array>}
     */
    getDependencies(taskId) {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { itemMap } = dataResult.value;
      const item = itemMap.get(taskId);

      if (!item) {
        return err({
          code: TaskErrorCode.NOT_FOUND,
          message: `${formatId(taskId)} nicht gefunden`
        });
      }

      const deps = item.deps.map(n => itemMap.get(n)).filter(Boolean);
      return ok(deps);
    }
  };
}

/**
 * Default Lookup-Service Instanz
 */
export const defaultLookupService = createLookupService();

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Parst Task-ID (numerisch oder alphanumerisch wie 428b)
 */
function parseTaskId(str) {
  if (/^b\d+$/.test(str)) return str;
  const match = str.match(/^#?(\d+[a-z]?)$/);
  if (match) {
    const id = match[1];
    return /\d+[a-z]$/.test(id) ? id : parseInt(id, 10);
  }
  return null;
}

/**
 * Parst CLI-Argumente für show command
 */
export function parseArgs(argv) {
  const opts = {
    itemId: null,
    tree: true,
    treeDepth: 3,
    json: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--no-tree') {
      opts.tree = false;
    } else if (arg === '--depth') {
      opts.treeDepth = parseInt(argv[++i], 10) || 3;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (!arg.startsWith('-')) {
      // Task-ID parsen
      if (arg.match(/^b\d+$/)) {
        opts.itemId = arg;
      } else {
        const parsed = parseTaskId(arg);
        if (parsed !== null) {
          opts.itemId = parsed;
        }
      }
    }
  }

  return opts;
}

/**
 * Führt den show command aus
 */
export function execute(opts, service = null) {
  const showService = service ?? createLookupService();

  if (!opts.itemId) {
    return {
      ok: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Task-ID erforderlich. Für Keyword-Suche: sort <keyword>'
      }
    };
  }

  const result = showService.getTask(opts.itemId);
  if (!result.ok) return result;

  const data = { item: result.value.item };

  // IMMER beide Trees (außer --no-tree)
  if (opts.tree !== false) {
    const depsResult = showService.getDependencyTree(opts.itemId, opts.treeDepth);
    if (depsResult.ok) data.dependencyTree = depsResult.value;

    const dependentsResult = showService.getDependentTree(opts.itemId, opts.treeDepth);
    if (dependentsResult.ok) data.dependentTree = dependentsResult.value;
  }

  if (result.value.claim) {
    data.claim = result.value.claim;
  }

  return { ok: true, value: data };
}

/**
 * Zeigt Hilfe für show command
 */
export function showHelp() {
  return `
Show Command - Task-Details mit Dependency-Trees anzeigen

USAGE:
  node scripts/task.mjs show <ID>

ARGUMENTE:
  <ID>                   Task-ID (z.B. 428, #428, 428b) oder Bug-ID (z.B. b4)

OPTIONEN:
  --depth <N>            Tiefe der Trees (default: 3)
  --no-tree              Keine Trees anzeigen
  --json                 JSON-Ausgabe
  -h, --help             Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task.mjs show 428             # Task #428 Details + Trees
  node scripts/task.mjs show 428b            # Task #428b Details
  node scripts/task.mjs show b4              # Bug b4 Details
  node scripts/task.mjs show 428 --depth 5   # Tieferer Baum
  node scripts/task.mjs show 428 --no-tree   # Ohne Trees

HINWEIS:
  Für Keyword-Suche nutze: sort <keyword>
`;
}
