// Ziel: Tasks und Bugs löschen
// Siehe: docs/tools/taskTool.md#remove---tasksbugs-löschen
//
// Funktionen:
// - removeTask(taskId, tasks, bugs, claims) - Task löschen
// - removeBug(bugId, resolve, tasks, bugs, claims) - Bug löschen (optional mit Resolution)
// - cleanupBugReferences(bugId, tasks) - Bug-Referenz aus Task-Deps entfernen
// - cleanupTaskReferences(taskId, tasks) - Task-Referenz aus Dependent-Deps entfernen
// - cleanupClaim(id, claims) - Claim aus Claims-Daten entfernen

import { ok, err } from '../core/result.mjs';

/**
 * Entfernt Claim für eine Task/Bug aus Claims-Daten.
 * @param {string} id - Task-ID (ohne #) oder Bug-ID
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @returns {boolean} - true wenn Claim entfernt wurde
 */
function cleanupClaim(id, claims) {
  const claim = claims.claims[id];
  if (claim) {
    delete claims.claims[id];
    delete claims.keys[claim.key];
    return true;
  }
  return false;
}

/**
 * Entfernt Task-Referenz aus allen Dependent-Dependencies.
 * @param {string} taskId
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @returns {import('../core/table/parser.mjs').Task[]}
 */
function cleanupTaskReferences(taskId, tasks) {
  const normalizedId = taskId.replace('#', '');
  const updatedTasks = [];

  for (const task of tasks) {
    const originalLength = task.deps.length;
    task.deps = task.deps.filter(d => d !== `#${normalizedId}` && d !== normalizedId);

    if (task.deps.length !== originalLength) {
      updatedTasks.push(task);
    }
  }

  return updatedTasks;
}

/**
 * Löscht eine Task.
 * @param {string} taskId
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @returns {import('../core/result.mjs').Result<{removedTask: import('../core/table/parser.mjs').Task, claimRemoved: boolean, cleanedDependents: import('../core/table/parser.mjs').Task[]}, {code: string}>}
 */
export function removeTask(taskId, tasks, bugs, claims) {
  const normalizedId = taskId.replace('#', '');
  const taskIndex = tasks.findIndex(t => String(t.id) === normalizedId);

  if (taskIndex === -1) {
    return err({ code: 'TASK_NOT_FOUND', id: taskId });
  }

  const removedTask = tasks[taskIndex];

  // Claim entfernen falls vorhanden
  const claimRemoved = cleanupClaim(normalizedId, claims);

  // Task-Referenz aus Dependents entfernen
  const cleanedDependents = cleanupTaskReferences(normalizedId, tasks);

  // Task entfernen
  tasks.splice(taskIndex, 1);

  return ok({ removedTask, claimRemoved, cleanedDependents });
}

/**
 * Löscht einen Bug.
 * @param {string} bugId - Bug-ID (z.B. 'b1')
 * @param {boolean} resolve - Wenn true, Bug-Referenz aus Task-Deps entfernen
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @returns {import('../core/result.mjs').Result<{removedBug: import('../core/table/parser.mjs').Bug, claimRemoved: boolean, updatedTasks?: import('../core/table/parser.mjs').Task[]}, {code: string}>}
 */
export function removeBug(bugId, resolve, tasks, bugs, claims) {
  const bugIndex = bugs.findIndex(b => b.id === bugId);

  if (bugIndex === -1) {
    return err({ code: 'BUG_NOT_FOUND', id: bugId });
  }

  const removedBug = bugs[bugIndex];

  // Claim entfernen falls vorhanden
  const claimRemoved = cleanupClaim(bugId, claims);

  // Bug entfernen
  bugs.splice(bugIndex, 1);

  // Bei --resolve: Bug aus Task-Dependencies entfernen
  let updatedTasks;
  if (resolve) {
    updatedTasks = cleanupBugReferences(bugId, tasks);
  }

  return ok({ removedBug, claimRemoved, updatedTasks });
}

/**
 * Entfernt Bug-Referenz aus allen Task-Dependencies.
 * @param {string} bugId
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @returns {import('../core/table/parser.mjs').Task[]}
 */
export function cleanupBugReferences(bugId, tasks) {
  const updatedTasks = [];

  for (const task of tasks) {
    const originalLength = task.deps.length;
    task.deps = task.deps.filter(d => d !== bugId);

    if (task.deps.length !== originalLength) {
      updatedTasks.push(task);
    }
  }

  return updatedTasks;
}
