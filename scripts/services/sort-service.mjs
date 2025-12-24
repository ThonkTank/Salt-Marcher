/**
 * Prioritize Service
 *
 * Koordiniert alle Task-Priorisierungs-Operationen.
 * Nutzt RoadmapPort für Daten und ClaimService für Claim-Info.
 */

import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { formatId, isTaskId } from '../core/table/parser.mjs';
import { STATUS_PRIORITY, MVP_PRIORITY, PRIO_PRIORITY } from '../core/table/schema.mjs';
import { findInconsistencies as findInconsistenciesCore } from '../core/consistency/checker.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { createClaimService } from './claim-service.mjs';

/**
 * @typedef {object} PrioritizeFilters
 * @property {string[]} [keywords] - Keyword-Filter (ODER-Verknüpfung)
 * @property {string} [status] - Nur Tasks mit diesem Status
 * @property {boolean} [mvp] - true = nur MVP, false = nur nicht-MVP
 * @property {string} [prio] - Nur Tasks mit dieser Priorität
 * @property {boolean} [includeDone] - Auch ✅ Tasks
 * @property {boolean} [includeBlocked] - Auch blockierte Tasks
 * @property {boolean} [includeClaimed] - Auch 🔒 Tasks
 * @property {boolean} [includeResolved] - Auch ✅ Bugs
 * @property {number} [limit] - Max. Ergebnisse (0 = alle)
 */

/**
 * Erstellt einen Prioritize-Service
 *
 * @param {object} [options] - Optionen
 * @param {import('../ports/task-port.mjs').TaskPort} [options.taskAdapter] - Task-Adapter
 * @returns {PrioritizeService}
 */
export function createPrioritizeService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();

  /**
   * Lädt alle Items
   * @returns {import('../core/result.mjs').Result<{items: Array, tasks: Array, bugs: Array, statusMap: Map, refCounts: Map}>}
   */
  function loadData() {
    const loadResult = taskAdapter.load();
    if (!loadResult.ok) return loadResult;

    const { tasks, bugs, itemMap } = loadResult.value;
    const items = [...tasks, ...bugs];
    const statusMap = new Map(items.map(t => [t.number, t.status]));
    const refCounts = calculateRefCountsInternal(items);

    return ok({ items, tasks, bugs, itemMap, statusMap, refCounts });
  }

  /**
   * Berechnet wie viele Items auf jede Task/Bug verweisen
   */
  function calculateRefCountsInternal(items) {
    const refCount = new Map();
    for (const item of items) {
      for (const dep of item.deps) {
        refCount.set(dep, (refCount.get(dep) || 0) + 1);
      }
    }
    return refCount;
  }

  /**
   * Prüft ob alle Dependencies erfüllt sind
   */
  function areDepsResolved(item, statusMap) {
    return item.deps.every(dep => {
      if (typeof dep === 'string' && dep.startsWith('b')) {
        return true;
      }
      const status = statusMap.get(dep);
      return status === '✅';
    });
  }

  /**
   * Sortier-Vergleichsfunktion
   */
  function compareItems(a, b, refCounts) {
    const mvpDiff = (MVP_PRIORITY[a.mvp] ?? 99) - (MVP_PRIORITY[b.mvp] ?? 99);
    if (mvpDiff !== 0) return mvpDiff;

    const statusDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    const prioDiff = (PRIO_PRIORITY[a.prio] ?? 99) - (PRIO_PRIORITY[b.prio] ?? 99);
    if (prioDiff !== 0) return prioDiff;

    const refCountA = refCounts.get(a.number) || 0;
    const refCountB = refCounts.get(b.number) || 0;
    const refDiff = refCountB - refCountA;
    if (refDiff !== 0) return refDiff;

    const numA = typeof a.number === 'string' ? parseInt(a.number.slice(1), 10) : a.number;
    const numB = typeof b.number === 'string' ? parseInt(b.number.slice(1), 10) : b.number;

    if (a.isBug !== b.isBug) return a.isBug ? 1 : -1;

    return numA - numB;
  }

  /**
   * Prüft ob Task den Filtern entspricht
   */
  function matchesFilters(task, filters, statusMap) {
    const {
      keywords = [],
      status = null,
      mvp = null,
      prio = null,
      includeDone = false,
      includeBlocked = false,
      includeClaimed = false,
      includeResolved = false
    } = filters;

    if (task.status === '✅') {
      if (task.isBug && !includeResolved) return false;
      if (!task.isBug && !includeDone) return false;
    }
    if (!includeClaimed && task.status === '🔒') return false;
    if (status && task.status !== status) return false;

    if (!includeBlocked && !areDepsResolved(task, statusMap)) return false;

    if (mvp === true && task.mvp !== 'Ja') return false;
    if (mvp === false && task.mvp !== 'Nein') return false;

    if (prio && task.prio.toLowerCase() !== prio.toLowerCase()) return false;

    if (keywords.length > 0) {
      const searchText = `${task.domain} ${task.beschreibung}`.toLowerCase();
      if (!keywords.some(kw => searchText.includes(kw.toLowerCase()))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalisiert einen Zyklus für Vergleichbarkeit
   */
  function normalizeCycle(cycle) {
    const c = cycle.slice(0, -1);
    if (c.length === 0) return c;

    let minIdx = 0;
    for (let i = 1; i < c.length; i++) {
      const curr = c[i];
      const min = c[minIdx];

      if (typeof curr === 'number' && typeof min === 'string') {
        minIdx = i;
      } else if (typeof curr === typeof min) {
        if (curr < min) minIdx = i;
      }
    }

    return [...c.slice(minIdx), ...c.slice(0, minIdx)];
  }

  /**
   * Entfernt doppelte Zyklen
   */
  function deduplicateCycles(cycles) {
    const seen = new Set();
    return cycles.filter(cycle => {
      const normalized = normalizeCycle(cycle);
      const key = normalized.map(formatId).join('→');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Findet Zyklen in Items (interne Funktion)
   * @param {Array} items - Alle Items
   * @returns {Array<Array>} - Gefundene Zyklen
   */
  function findCyclesFromItems(items) {
    const graph = new Map();
    const allIds = new Set();

    for (const item of items) {
      if (item.isBug) continue;
      const taskDeps = item.deps.filter(isTaskId);
      graph.set(item.number, taskDeps);
      allIds.add(item.number);
    }

    const cycles = [];

    function dfs(node, path, pathSet) {
      if (pathSet.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }

      if (!allIds.has(node)) return;

      pathSet.add(node);
      path.push(node);

      const deps = graph.get(node) || [];
      for (const dep of deps) {
        dfs(dep, path, pathSet);
      }

      path.pop();
      pathSet.delete(node);
    }

    for (const id of allIds) {
      dfs(id, [], new Set());
    }

    return deduplicateCycles(cycles);
  }

  return {
    /**
     * Holt priorisierte Tasks nach Filtern
     *
     * @param {PrioritizeFilters} [filters] - Filter-Optionen
     * @returns {import('../core/result.mjs').Result<{items: Array, refCounts: Map, stats: object}>}
     */
    getPrioritizedTasks(filters = {}) {
      const { limit = 10 } = filters;

      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { items, tasks, bugs, statusMap, refCounts } = dataResult.value;

      // Statistiken sammeln
      const statusCounts = { '✅': 0, '📋': 0, '🔶': 0, '⚠️': 0, '⬜': 0, '🔒': 0 };
      let blockedCount = 0;
      for (const item of items) {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
        if (!areDepsResolved(item, statusMap)) {
          blockedCount++;
        }
      }

      // Filtern
      const filtered = items.filter(t => matchesFilters(t, filters, statusMap));

      // Sortieren
      filtered.sort((a, b) => compareItems(a, b, refCounts));

      // Limitieren
      const results = limit > 0 ? filtered.slice(0, limit) : filtered;

      // Zyklen finden
      const cycles = findCyclesFromItems(items);

      // Inkonsistenzen finden
      const defsResult = taskAdapter.getAllTaskDefinitions();
      const inconsistencies = defsResult.ok
        ? findInconsistenciesCore(defsResult.value)
        : [];

      return ok({
        items: results,
        refCounts,
        stats: {
          totalTasks: tasks.length,
          totalBugs: bugs.length,
          statusCounts,
          blockedCount,
          filteredCount: filtered.length
        },
        cycles,
        inconsistencies
      });
    },

    /**
     * Berechnet Referenzzählungen
     *
     * @returns {import('../core/result.mjs').Result<Map>}
     */
    getRefCounts() {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      return ok(dataResult.value.refCounts);
    },

    /**
     * Findet zirkuläre Dependencies
     *
     * @returns {import('../core/result.mjs').Result<Array<Array>>}
     */
    findCycles() {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      return ok(findCyclesFromItems(dataResult.value.items));
    },

    /**
     * Findet doppelte Task-IDs
     *
     * @returns {import('../core/result.mjs').Result<Array<{id, occurrences}>>}
     */
    findDuplicateIds() {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { tasks, bugs } = dataResult.value;
      const seen = new Map();
      const duplicates = [];

      for (const task of tasks) {
        const key = `task-${task.number}`;
        if (seen.has(key)) {
          seen.get(key).push(task);
        } else {
          seen.set(key, [task]);
        }
      }

      for (const bug of bugs) {
        const key = `bug-${bug.number}`;
        if (seen.has(key)) {
          seen.get(key).push(bug);
        } else {
          seen.set(key, [bug]);
        }
      }

      for (const [, occurrences] of seen) {
        if (occurrences.length > 1) {
          duplicates.push({
            id: occurrences[0].number,
            isBug: occurrences[0].isBug,
            occurrences
          });
        }
      }

      return ok(duplicates);
    },

    /**
     * Findet verwaiste Task-Referenzen in Docs
     *
     * @returns {import('../core/result.mjs').Result<Array<{file, id}>>}
     */
    findOrphanRefs() {
      const dataResult = loadData();
      if (!dataResult.ok) return dataResult;

      const { items } = dataResult.value;
      const roadmapIds = new Set(items.map(item => item.number));

      return taskAdapter.findOrphanReferences(roadmapIds);
    }
  };
}

/**
 * Default Prioritize-Service Instanz
 */
export const defaultPrioritizeService = createPrioritizeService();

// ============================================================================
// CLI Interface
// ============================================================================

const STATUS_ALIASES = {
  'open': '⬜', 'offen': '⬜',
  'ready': '🟢', 'bereit': '🟢',
  'done': '✅', 'fertig': '✅',
  'partial': '🔶', 'fast': '🔶',
  'broken': '⚠️', 'kaputt': '⚠️',
  'claimed': '🔒',
  'blocked': '⛔',
  'review': '📋'
};

/**
 * Parst CLI-Argumente für sort command
 */
export function parseArgs(argv) {
  const opts = {
    keywords: [],
    limit: 10,
    status: null,
    mvp: null,
    prio: null,
    includeDone: false,
    includeBlocked: false,
    includeClaimed: false,
    includeResolved: false,
    json: false,
    quiet: false,
    help: false
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '-n' || arg === '--limit') {
      opts.limit = parseInt(argv[++i], 10) || 10;
    } else if (arg === '-s' || arg === '--status') {
      const val = argv[++i];
      opts.status = STATUS_ALIASES[val?.toLowerCase()] || val;
    } else if (arg === '--mvp') {
      opts.mvp = true;
    } else if (arg === '--no-mvp') {
      opts.mvp = false;
    } else if (arg === '-p' || arg === '--prio') {
      opts.prio = argv[++i]?.toLowerCase();
    } else if (arg === '--include-done') {
      opts.includeDone = true;
    } else if (arg === '--include-blocked') {
      opts.includeBlocked = true;
    } else if (arg === '--include-claimed') {
      opts.includeClaimed = true;
    } else if (arg === '--include-resolved') {
      opts.includeResolved = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '-q' || arg === '--quiet') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      opts.keywords.push(arg);
    }
    i++;
  }

  return opts;
}

/**
 * Führt den sort command aus
 */
export function execute(opts, service = null) {
  const sortService = service ?? createPrioritizeService();
  return sortService.getPrioritizedTasks(opts);
}

/**
 * Zeigt Hilfe für sort command
 */
export function showHelp() {
  return `
Sort Command - Priorisierte Task-Liste

USAGE:
  node scripts/task.mjs sort [OPTIONS] [KEYWORDS...]

KEYWORDS:
  Beliebige Wörter zum Filtern in Bereich/Beschreibung (ODER-Verknüpfung)

FILTER-OPTIONEN:
  -s, --status <status>   Nur Tasks mit diesem Status
                          Werte: 📋, 🔶, ⚠️, ⬜, ✅ (oder: review, partial, broken, open, done)
  --mvp                   Nur MVP-Tasks
  --no-mvp                Nur Nicht-MVP-Tasks
  -p, --prio <prio>       Nur Tasks mit dieser Priorität (hoch, mittel, niedrig)
  --include-done          Auch ✅ Tasks anzeigen
  --include-blocked       Auch Tasks mit unerfüllten Dependencies anzeigen
  --include-claimed       Auch 🔒 (geclaimed) Tasks anzeigen
  --include-resolved      Auch ✅ (gelöste) Bugs anzeigen

OUTPUT-OPTIONEN:
  -n, --limit <N>         Anzahl der Ergebnisse (default: 10, 0 = alle)
  --json                  JSON-Ausgabe statt Tabelle
  -q, --quiet             Nur Tabelle, keine Statistiken
  -h, --help              Diese Hilfe anzeigen

SORTIERKRITERIEN:
  1. MVP: Ja > Nein
  2. Status: 📋 > 🔶 > ⚠️ > ⬜
  3. Prio: hoch > mittel > niedrig
  4. RefCount: Tasks, von denen viele andere abhängen
  5. Task-Nummer: Niedrigere = älter = höhere Priorität

BEISPIELE:
  node scripts/task.mjs sort                     # Top 10 aller offenen Tasks
  node scripts/task.mjs sort quest               # Tasks mit "quest"
  node scripts/task.mjs sort -n 5 --mvp          # Top 5 MVP-Tasks
  node scripts/task.mjs sort --status 🔶         # Nur fast fertige Tasks
  node scripts/task.mjs sort --prio hoch -n 0    # Alle hoch-prio Tasks
`;
}
