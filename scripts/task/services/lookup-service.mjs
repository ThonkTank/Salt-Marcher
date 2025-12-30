// Ziel: Task/Bug finden, Dependency-Baum aufbauen, Details formatieren
// Siehe: docs/tools/taskTool.md#show---task-details-anzeigen
//
// Funktionen:
// - findById(id, tasks, bugs) - Task oder Bug nach ID finden
// - buildDependencyTree(item, allTasks, allBugs, depth, visited) - Rekursiver Dependency-Baum
// - findDependents(id, allTasks) - Alle Tasks finden die von ID abhängen
// - formatDetails(item, depTree, claims, allTasks) - Details für Console formatieren

/**
 * Findet Task oder Bug nach ID.
 * @param {string} id - Task-ID (#14) oder Bug-ID (b1)
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @returns {import('../core/table/parser.mjs').Task | import('../core/table/parser.mjs').Bug | null}
 */
export function findById(id, tasks, bugs) {
  // Task-ID: #14 oder 14
  if (id.startsWith('#') || /^\d+$/.test(id)) {
    const numId = parseInt(id.replace('#', ''), 10);
    return tasks.find(t => t.id === numId) || null;
  }

  // Bug-ID: b1
  if (id.startsWith('b')) {
    return bugs.find(b => b.id === id) || null;
  }

  return null;
}

/**
 * Baut rekursiven Dependency-Baum.
 * @param {import('../core/table/parser.mjs').Task | import('../core/table/parser.mjs').Bug} item
 * @param {import('../core/table/parser.mjs').Task[]} allTasks
 * @param {import('../core/table/parser.mjs').Bug[]} allBugs
 * @param {number} [depth=0]
 * @param {Set<string>} [visited]
 * @returns {DependencyNode}
 */
export function buildDependencyTree(item, allTasks, allBugs, depth = 0, visited = new Set()) {
  const MAX_DEPTH = 10;
  const id = 'id' in item && typeof item.id === 'number' ? `#${item.id}` : item.id;

  // Basis-Node erstellen
  const node = {
    id,
    status: item.status,
    beschreibung: item.beschreibung,
    children: [],
  };

  // Zyklus-Erkennung oder Max-Tiefe erreicht
  if (visited.has(id) || depth >= MAX_DEPTH) {
    return node;
  }

  visited.add(id);

  // Dependencies rekursiv auflösen
  for (const depId of item.deps) {
    const dep = findById(depId, allTasks, allBugs);
    if (dep) {
      const childNode = buildDependencyTree(dep, allTasks, allBugs, depth + 1, new Set(visited));
      node.children.push(childNode);
    } else {
      // Dependency nicht gefunden - als unresolved markieren
      node.children.push({
        id: depId,
        status: '❓',
        beschreibung: '(nicht gefunden)',
        children: [],
      });
    }
  }

  return node;
}

/**
 * Findet alle Tasks die von einer ID abhängen.
 * @param {string} id - Task oder Bug ID
 * @param {import('../core/table/parser.mjs').Task[]} allTasks
 * @returns {import('../core/table/parser.mjs').Task[]}
 */
export function findDependents(id, allTasks) {
  const normalizedId = id.startsWith('#') ? id : `#${id}`;
  return allTasks.filter(t => t.deps.includes(normalizedId));
}

/**
 * Formatiert Task-Details für Console-Output.
 * @param {import('../core/table/parser.mjs').Task | import('../core/table/parser.mjs').Bug} item
 * @param {DependencyNode} depTree
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @param {import('../core/table/parser.mjs').Task[]} [allTasks]
 * @returns {string}
 */
export function formatDetails(item, depTree, claims, allTasks = []) {
  const lines = [];
  const isTask = typeof item.id === 'number';
  const id = isTask ? `#${item.id}` : item.id;

  // Header
  lines.push(`${isTask ? 'Task' : 'Bug'} ${id}: ${item.beschreibung}`);
  lines.push('');

  // Status-Zeile
  const statusLine = [`Status: ${item.status}`, `Prio: ${item.prio}`];
  if (isTask && 'mvp' in item) {
    statusLine.push(`MVP: ${item.mvp ? 'Ja' : 'Nein'}`);
  }
  lines.push(statusLine.join('  '));

  // Domain/Layer (nur für Tasks)
  if (isTask && 'domain' in item && 'layer' in item) {
    const domainStr = Array.isArray(item.domain) ? item.domain.join(', ') : item.domain;
    const layerStr = Array.isArray(item.layer) ? item.layer.join(', ') : item.layer;
    lines.push(`Domain: ${domainStr}  Layer: ${layerStr}`);
  }

  // Dependencies
  if (depTree.children.length > 0) {
    const depsStr = depTree.children
      .map(c => `${c.id} (${c.status} ${c.beschreibung.slice(0, 30)}${c.beschreibung.length > 30 ? '...' : ''})`)
      .join(', ');
    lines.push(`Deps: ${depsStr}`);
  } else {
    lines.push('Deps: -');
  }

  // Dependents (Tasks die von dieser abhängen)
  const dependents = findDependents(id, allTasks);
  if (dependents.length > 0) {
    const depsStr = dependents
      .map(d => `#${d.id} (${d.status})`)
      .join(', ');
    lines.push(`Depended by: ${depsStr}`);
  }

  // Spec/Impl (nur für Tasks)
  if (isTask && 'spec' in item && 'impl' in item) {
    lines.push(`Spec: ${item.spec || '-'}`);
    lines.push(`Impl: ${item.impl || '-'}`);
  }

  // Claim-Info
  const taskId = String(item.id);
  if (claims.claims && claims.claims[taskId]) {
    const claim = claims.claims[taskId];
    const elapsed = Date.now() - claim.timestamp;
    const remaining = 2 * 60 * 60 * 1000 - elapsed; // 2h in ms

    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60000);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
      lines.push(`Claim: ${claim.key} (${timeStr} verbleibend)`);
    } else {
      lines.push(`Claim: ${claim.key} (ABGELAUFEN)`);
    }
  }

  return lines.join('\n');
}

/**
 * @typedef {Object} DependencyNode
 * @property {string} id
 * @property {string} status
 * @property {string} beschreibung
 * @property {DependencyNode[]} children
 */
