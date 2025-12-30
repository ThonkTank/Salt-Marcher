// Ziel: Tasks und Bugs sortieren und filtern für 'sort' Befehl
// Siehe: docs/tools/taskTool.md#sort---tasks-priorisiert-ausgeben
//
// Funktionen:
// - sortTasks(tasks, options) - Tasks nach Prioritätskriterien sortieren
// - filterTasks(tasks, options) - Tasks nach Kriterien filtern
// - formatTaskList(tasks) - Sortierte Liste für Console formatieren
// - sortBugs(bugs) - Bugs nach Prioritätskriterien sortieren
// - filterBugs(bugs, options) - Bugs nach Kriterien filtern
// - formatBugList(bugs) - Bug-Liste für Console formatieren
// - getStatusPriority(statusSymbol) - Status-Priorität für Sortierung

import { STATUS, PRIORITIES } from '../core/table/schema.mjs';

/**
 * Sortiert Tasks nach Prioritätskriterien.
 * Reihenfolge: Status > Prio > MVP > Deps-Anzahl
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {SortOptions} [options]
 * @returns {import('../core/table/parser.mjs').Task[]}
 */
export function sortTasks(tasks, options = {}) {
  return [...tasks].sort((a, b) => {
    // 1. Status-Priorität: 🟢 > 🔶 > ⬜ > ⚠️ > andere
    const statusA = getStatusPriority(a.status);
    const statusB = getStatusPriority(b.status);
    if (statusA !== statusB) return statusA - statusB;

    // 2. Priorität: hoch > mittel > niedrig
    const prioA = PRIORITIES[a.prio] ?? 0;
    const prioB = PRIORITIES[b.prio] ?? 0;
    if (prioA !== prioB) return prioB - prioA;

    // 3. MVP: Ja > Nein
    if (a.mvp !== b.mvp) return a.mvp ? -1 : 1;

    // 4. Dependencies: Weniger > Mehr
    return a.deps.length - b.deps.length;
  });
}

/**
 * Filtert Tasks nach Kriterien.
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {FilterOptions} options
 * @returns {import('../core/table/parser.mjs').Task[]}
 */
export function filterTasks(tasks, options) {
  return tasks.filter(task => {
    // Keyword in allen Feldern (case-insensitive)
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      const searchFields = [
        task.beschreibung,
        ...task.domain,
        ...task.layer,
        ...task.spec,
        ...task.impl
      ].map(f => f.toLowerCase());

      if (!searchFields.some(f => f.includes(keyword))) {
        return false;
      }
    }

    // Status-Filter
    if (options.status && task.status !== options.status) {
      return false;
    }

    // Domain-Filter (task.domain ist ein Array)
    if (options.domain) {
      const filterDomain = options.domain.toLowerCase();
      const taskDomains = task.domain.map(d => d.toLowerCase());
      if (!taskDomains.some(d => d.includes(filterDomain))) {
        return false;
      }
    }

    // Layer-Filter (task.layer ist ein Array)
    if (options.layer) {
      const filterLayer = options.layer.toLowerCase();
      const taskLayers = task.layer.map(l => l.toLowerCase());
      if (!taskLayers.some(l => l.includes(filterLayer))) {
        return false;
      }
    }

    // MVP-Filter
    if (options.mvp !== undefined && task.mvp !== options.mvp) {
      return false;
    }

    // Prio-Filter
    if (options.prio && task.prio !== options.prio) {
      return false;
    }

    return true;
  });
}

/**
 * Formatiert Task-Liste für Console-Output.
 * Zeigt alle Felder: id, status, prio, mvp, domain, layer, beschreibung, deps, spec, impl
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @returns {string}
 */
export function formatTaskList(tasks) {
  return tasks
    .map(t => {
      const mvp = t.mvp ? '[MVP]' : '';
      const domain = t.domain.join(', ');
      const layer = t.layer.join(', ');
      const deps = t.deps.length > 0 ? t.deps.join(', ') : '-';
      const spec = t.spec || '-';
      const impl = t.impl || '-';

      return `#${t.id} ${t.status} [${t.prio}] ${mvp} ${domain} | ${layer} | ${t.beschreibung}
     Deps: ${deps} | Spec: ${spec} | Impl: ${impl}`;
    })
    .join('\n\n');
}

/**
 * Sortiert Bugs nach Prioritätskriterien.
 * Reihenfolge: Status > Prio > Deps-Anzahl
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @returns {import('../core/table/parser.mjs').Bug[]}
 */
export function sortBugs(bugs) {
  return [...bugs].sort((a, b) => {
    // 1. Status-Priorität
    const statusA = getStatusPriority(a.status);
    const statusB = getStatusPriority(b.status);
    if (statusA !== statusB) return statusA - statusB;

    // 2. Priorität: hoch > mittel > niedrig
    const prioA = PRIORITIES[a.prio] ?? 0;
    const prioB = PRIORITIES[b.prio] ?? 0;
    if (prioA !== prioB) return prioB - prioA;

    // 3. Dependencies: Weniger > Mehr
    return a.deps.length - b.deps.length;
  });
}

/**
 * Filtert Bugs nach Kriterien.
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @param {BugFilterOptions} options
 * @returns {import('../core/table/parser.mjs').Bug[]}
 */
export function filterBugs(bugs, options) {
  return bugs.filter(bug => {
    // Keyword in Beschreibung (case-insensitive)
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      if (!bug.beschreibung.toLowerCase().includes(keyword)) {
        return false;
      }
    }

    // Status-Filter
    if (options.status && bug.status !== options.status) {
      return false;
    }

    // Prio-Filter
    if (options.prio && bug.prio !== options.prio) {
      return false;
    }

    return true;
  });
}

/**
 * Formatiert Bug-Liste für Console-Output.
 * Zeigt alle Felder: id, status, prio, beschreibung, deps
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @returns {string}
 */
export function formatBugList(bugs) {
  return bugs
    .map(b => {
      const deps = b.deps.length > 0 ? b.deps.join(', ') : '-';
      return `${b.id} ${b.status} [${b.prio}] ${b.beschreibung}
     Deps: ${deps}`;
    })
    .join('\n\n');
}

/**
 * Holt Status-Priorität für Sortierung.
 * Niedrigere Zahl = höhere Priorität in der Ausgabe.
 * @param {string} statusSymbol
 * @returns {number}
 */
function getStatusPriority(statusSymbol) {
  // Sortierreihenfolge: 🟢 > 🔶 > ⬜ > ⚠️ > andere
  const order = {
    '🟢': 1,  // ready
    '🔶': 2,  // partial
    '⬜': 3,  // open
    '⚠️': 4,  // broken
    '📋': 5,  // review
    '⛔': 6,  // blocked
    '🔒': 7,  // claimed
    '✅': 8,  // done
  };
  return order[statusSymbol] ?? 99;
}

/**
 * @typedef {Object} SortOptions
 * @property {'status'|'prio'|'mvp'|'deps'} [primary]
 */

/**
 * @typedef {Object} FilterOptions
 * @property {string} [keyword]
 * @property {string} [status]
 * @property {string} [domain]
 * @property {string} [layer]
 * @property {boolean} [mvp]
 * @property {string} [prio]
 */

/**
 * @typedef {Object} BugFilterOptions
 * @property {string} [keyword]
 * @property {string} [status]
 * @property {string} [prio]
 */
