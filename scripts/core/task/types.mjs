/**
 * Task Types and Utilities
 *
 * Type-Definitionen und Hilfsfunktionen für Tasks und Bugs.
 */

import { TaskStatus, isValidStatus } from '../table/schema.mjs';
import { parseTaskId, parseDeps, formatId, formatDeps, isTaskId, isBugId } from '../table/parser.mjs';

// Re-export für Convenience
export { parseTaskId, parseDeps, formatId, formatDeps, isTaskId, isBugId };

/**
 * @typedef {object} Task
 * @property {number|string} number - Task-ID (Zahl oder alphanumerisch wie "428b")
 * @property {string} status - Status-Emoji
 * @property {string} bereich - Bereich/Kategorie
 * @property {string} beschreibung - Beschreibung
 * @property {string} prio - Priorität (hoch/mittel/niedrig)
 * @property {string} mvp - MVP-Flag (Ja/Nein)
 * @property {Array<string|number>} deps - Dependencies (Task-IDs und Bug-IDs)
 * @property {string} depsRaw - Original deps String
 * @property {string} spec - Spec-Referenz
 * @property {string} imp - Implementation-Referenz
 * @property {number} [lineIndex] - Zeilen-Index in der Datei
 * @property {string} [originalLine] - Original-Zeile
 * @property {boolean} isBug - Ist Bug (false)
 */

/**
 * @typedef {object} Bug
 * @property {string} number - Bug-ID (z.B. "b1")
 * @property {string} status - Status-Emoji
 * @property {string} bereich - Immer "Bug"
 * @property {string} beschreibung - Beschreibung
 * @property {string} prio - Priorität
 * @property {string} mvp - Immer "Ja"
 * @property {Array<string|number>} deps - Dependencies
 * @property {string} depsRaw - Original deps String
 * @property {number} [lineIndex] - Zeilen-Index
 * @property {string} [originalLine] - Original-Zeile
 * @property {boolean} isBug - Ist Bug (true)
 */

/**
 * Normalisiert eine Task-ID für Vergleiche
 * @param {string|number} id - ID
 * @returns {string} - Normalisierte ID
 */
export function normalizeId(id) {
  if (typeof id === 'number') return String(id);
  return String(id).toLowerCase();
}

/**
 * Vergleicht zwei Task-IDs
 * @param {string|number} a - Erste ID
 * @param {string|number} b - Zweite ID
 * @returns {boolean} - true wenn gleich
 */
export function idsEqual(a, b) {
  return normalizeId(a) === normalizeId(b);
}

/**
 * Extrahiert die numerische Basis einer ID
 * z.B. "428b" -> 428, "b4" -> 4
 * @param {string|number} id - ID
 * @returns {number} - Numerische Basis
 */
export function getIdNumber(id) {
  if (typeof id === 'number') return id;
  const match = String(id).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Sortiert IDs numerisch
 * @param {Array<string|number>} ids - IDs
 * @returns {Array<string|number>} - Sortierte IDs
 */
export function sortIds(ids) {
  return [...ids].sort((a, b) => {
    // Bugs nach Tasks
    const aIsBug = isBugId(a);
    const bIsBug = isBugId(b);
    if (aIsBug !== bIsBug) return aIsBug ? 1 : -1;

    // Numerisch sortieren
    return getIdNumber(a) - getIdNumber(b);
  });
}

/**
 * Prüft ob eine Task alle Dependencies erfüllt hat
 * @param {object} task - Task mit deps Array
 * @param {Map<string|number, object>} itemMap - Map aller Items
 * @param {object} [options] - Optionen
 * @param {boolean} [options.ignoreBugDeps=true] - Bug-Dependencies ignorieren
 * @returns {boolean} - true wenn alle Deps erfüllt
 */
export function areDepsResolved(task, itemMap, options = {}) {
  const { ignoreBugDeps = true } = options;

  if (!task.deps || task.deps.length === 0) return true;

  return task.deps.every(depId => {
    // Bug-Deps optional ignorieren
    if (ignoreBugDeps && isBugId(depId)) return true;

    const depItem = itemMap.get(depId);
    if (!depItem) return true; // Nicht existierende Deps ignorieren

    return depItem.status === TaskStatus.DONE;
  });
}

/**
 * Findet alle Tasks die von einer bestimmten Task abhängen
 * @param {string|number} taskId - Die Task-ID
 * @param {object[]} allItems - Alle Tasks/Bugs
 * @returns {object[]} - Abhängige Tasks
 */
export function findDependents(taskId, allItems) {
  const taskIdStr = normalizeId(taskId);
  return allItems.filter(item =>
    item.deps?.some(depId => normalizeId(depId) === taskIdStr)
  );
}

/**
 * Findet alle Tasks die transitiv von einer Task abhängen
 * @param {string|number} taskId - Die Task-ID
 * @param {object[]} allItems - Alle Tasks/Bugs
 * @returns {Set<string>} - Set von abhängigen Task-IDs
 */
export function findAllDependents(taskId, allItems) {
  const dependents = new Set();
  const queue = [normalizeId(taskId)];

  while (queue.length > 0) {
    const currentId = queue.shift();

    for (const item of allItems) {
      const itemIdStr = normalizeId(item.number);
      if (dependents.has(itemIdStr)) continue;

      const depIds = item.deps?.map(d => normalizeId(d)) ?? [];
      if (depIds.includes(currentId)) {
        dependents.add(itemIdStr);
        queue.push(itemIdStr);
      }
    }
  }

  return dependents;
}

/**
 * Findet zirkuläre Dependencies
 * @param {object[]} allItems - Alle Tasks/Bugs
 * @returns {Array<string[]>} - Array von Zyklen (jeder Zyklus ist ein Pfad von IDs)
 */
export function findCircularDeps(allItems) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();

  function dfs(itemId, path) {
    const itemIdStr = normalizeId(itemId);

    if (recursionStack.has(itemIdStr)) {
      // Zyklus gefunden
      const cycleStart = path.indexOf(itemIdStr);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), itemIdStr]);
      }
      return;
    }

    if (visited.has(itemIdStr)) return;

    visited.add(itemIdStr);
    recursionStack.add(itemIdStr);
    path.push(itemIdStr);

    const item = allItems.find(i => normalizeId(i.number) === itemIdStr);
    if (item?.deps) {
      for (const depId of item.deps) {
        dfs(depId, path);
      }
    }

    path.pop();
    recursionStack.delete(itemIdStr);
  }

  for (const item of allItems) {
    dfs(item.number, []);
  }

  return cycles;
}
