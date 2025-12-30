// Ziel: Dependency-Status-Propagation bei Änderungen
// Siehe: docs/tools/taskTool.md#dependency-propagation

import { STATUS } from '../table/schema.mjs';

// TODO: propagateStatus(changedId, newStatus, allTasks, allBugs) - Status zu Dependents propagieren
// TODO: areDependenciesSatisfied(task, allTasks, allBugs) - Prüfen ob alle Deps erfüllt
// TODO: findDependents(id, allTasks) - Alle Tasks finden die von ID abhängen
// TODO: wouldCreateCycle(fromId, toId, allTasks) - Zyklische Dependencies erkennen

/**
 * Propagiert Status-Änderung zu abhängigen Tasks.
 * @param {string} changedId - ID der geänderten Task/Bug
 * @param {string} newStatus - Neuer Status-Symbol
 * @param {import('../table/parser.mjs').Task[]} allTasks
 * @param {import('../table/parser.mjs').Bug[]} allBugs
 * @returns {{ updatedTasks: import('../table/parser.mjs').Task[], updatedBugs: import('../table/parser.mjs').Bug[] }}
 */
export function propagateStatus(changedId, newStatus, allTasks, allBugs) {
  const updatedTasks = [];
  const updatedBugs = [];

  // TODO: Implementierung
  // Regeln:
  // 1. Task wird ⛔ → Alle Dependents werden ⛔
  // 2. Task wird ✅ → Dependents prüfen ob alle Deps erfüllt
  // 3. Bug wird erstellt → Referenzierte Tasks werden ⚠️ (in add-service)
  // 4. Bug wird resolved → Tasks aus Bug-Deps werden aktualisiert

  if (newStatus === STATUS.blocked.symbol) {
    // Alle Dependents blockieren
    const dependents = findDependents(changedId, allTasks);
    for (const dep of dependents) {
      if (dep.status !== STATUS.blocked.symbol) {
        dep.status = STATUS.blocked.symbol;
        updatedTasks.push(dep);
        // Rekursiv weiterpropagieren
        const nested = propagateStatus(`#${dep.id}`, STATUS.blocked.symbol, allTasks, allBugs);
        updatedTasks.push(...nested.updatedTasks);
      }
    }
  }

  if (newStatus === STATUS.done.symbol) {
    // Prüfen ob Dependents jetzt unblocked werden können
    const dependents = findDependents(changedId, allTasks);
    for (const dep of dependents) {
      if (dep.status === STATUS.blocked.symbol && areDependenciesSatisfied(dep, allTasks, allBugs)) {
        dep.status = STATUS.open.symbol;
        updatedTasks.push(dep);
      }
    }
  }

  return { updatedTasks, updatedBugs };
}

/**
 * Prüft ob alle Dependencies einer Task erfüllt sind.
 * @param {import('../table/parser.mjs').Task} task
 * @param {import('../table/parser.mjs').Task[]} allTasks
 * @param {import('../table/parser.mjs').Bug[]} allBugs
 * @returns {boolean}
 */
export function areDependenciesSatisfied(task, allTasks, allBugs) {
  for (const depId of task.deps) {
    // Task-Dependency
    if (depId.startsWith('#') || /^\d+$/.test(depId)) {
      const taskId = depId.replace('#', '');
      const depTask = allTasks.find(t => String(t.id) === taskId);
      if (!depTask || depTask.status !== STATUS.done.symbol) {
        return false;
      }
    }

    // Bug-Dependency (Bug muss resolved sein = nicht mehr existieren)
    if (depId.startsWith('b')) {
      const depBug = allBugs.find(b => b.id === depId);
      if (depBug) {
        // Bug existiert noch = nicht resolved
        return false;
      }
    }
  }

  return true;
}

/**
 * Findet alle Tasks die von einer ID abhängen.
 * @param {string} id - Task oder Bug ID
 * @param {import('../table/parser.mjs').Task[]} allTasks
 * @returns {import('../table/parser.mjs').Task[]}
 */
export function findDependents(id, allTasks) {
  const normalizedId = id.startsWith('#') ? id : `#${id}`;
  const bareId = id.replace('#', '');

  return allTasks.filter(t =>
    t.deps.includes(normalizedId) ||
    t.deps.includes(bareId) ||
    t.deps.includes(id)
  );
}

/**
 * Prüft ob das Hinzufügen einer Dependency einen Zyklus erzeugen würde.
 * @param {string} fromId - Task die Dependency bekommt
 * @param {string} toId - Neue Dependency
 * @param {import('../table/parser.mjs').Task[]} allTasks
 * @returns {boolean}
 */
export function wouldCreateCycle(fromId, toId, allTasks) {
  // TODO: Implementierung
  // DFS von toId aus: Kann man fromId erreichen?
  const visited = new Set();
  const normalizedFromId = fromId.replace('#', '');

  function dfs(currentId) {
    if (currentId === normalizedFromId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const task = allTasks.find(t => String(t.id) === currentId);
    if (!task) return false;

    for (const dep of task.deps) {
      if (dep.startsWith('#') || /^\d+$/.test(dep)) {
        const depId = dep.replace('#', '');
        if (dfs(depId)) return true;
      }
    }

    return false;
  }

  const normalizedToId = toId.replace('#', '');
  return dfs(normalizedToId);
}
