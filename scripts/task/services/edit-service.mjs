// Ziel: Task-Eigenschaften bearbeiten
// Siehe: docs/tools/taskTool.md#edit---task-bearbeiten
//
// Funktionen:
// - editTask(taskId, changes, claimKey, tasks, bugs, claims) - Task bearbeiten (async)
// - applyChanges(task, changes, tasks, bugs) - Änderungen auf Task anwenden

import { ok, err } from '../core/result.mjs';
import { validateClaim } from './claim-service.mjs';
import { STATUS, isValidStatus } from '../core/table/schema.mjs';
import { propagateStatus, areDependenciesSatisfied, wouldCreateCycle } from '../core/deps/propagation.mjs';
import { syncTask } from './sync-service.mjs';

/**
 * Bearbeitet eine Task mit validierten Änderungen.
 * @param {string} taskId
 * @param {EditOptions} changes
 * @param {string|null} claimKey - Optional: Nur erforderlich wenn Task geclaimed ist
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @param {import('../adapters/fs-task-adapter.mjs').ClaimsData} claims
 * @returns {Promise<import('../core/result.mjs').Result<{task: import('../core/table/parser.mjs').Task, claimReleased: boolean, updatedTasks: import('../core/table/parser.mjs').Task[]}, {code: string}>>}
 */
export async function editTask(taskId, changes, claimKey, tasks, bugs, claims) {
  // 1. Task finden
  const normalizedId = taskId.replace('#', '');
  const task = tasks.find(t => String(t.id) === normalizedId);
  if (!task) {
    return err({ code: 'TASK_NOT_FOUND', id: taskId });
  }

  // 2. Claim validieren nur wenn Task geclaimed ist (🔒)
  if (task.status === STATUS.claimed.symbol) {
    if (!claimKey) {
      return err({ code: 'TASK_CLAIMED', id: taskId });
    }
    const claimResult = validateClaim(taskId, claimKey, claims);
    if (!claimResult.ok) {
      return claimResult;
    }
  }

  // 3. Bei Status-Änderung (außer → ⛔): Dependencies prüfen
  if (changes.status && changes.status !== STATUS.blocked.symbol) {
    if (task.deps.length > 0 && !areDependenciesSatisfied(task, tasks, bugs)) {
      return err({ code: 'DEPS_NOT_MET', id: taskId });
    }
  }

  // 4. Alte Referenzen speichern (für Sync-Diff)
  const oldSpec = [...task.spec];
  const oldImpl = [...task.impl];

  // 5. Änderungen anwenden
  const applyResult = applyChanges(task, changes, tasks, bugs);
  if (!applyResult.ok) {
    return applyResult;
  }

  // 6. Bei Status-Änderung (nicht auf 🔒): Claim freigeben (nur wenn geclaimed war)
  let claimReleased = false;
  if (changes.status && changes.status !== STATUS.claimed.symbol && claimKey) {
    delete claims.claims[normalizedId];
    delete claims.keys[claimKey];
    claimReleased = true;
  }

  // 7. Status-Änderung zu Dependents propagieren
  let updatedTasks = [];
  if (changes.status) {
    const propagation = propagateStatus(`#${task.id}`, changes.status, tasks, bugs);
    updatedTasks = propagation.updatedTasks;
  }

  // 8. Dateien synchronisieren
  // 8a. Entfernte Referenzen: Task aus alten Dateien entfernen
  const removedSpecs = oldSpec.filter(s => !task.spec.includes(s));
  const removedImpls = oldImpl.filter(i => !task.impl.includes(i));
  if (removedSpecs.length || removedImpls.length) {
    const oldTask = { ...task, spec: removedSpecs, impl: removedImpls };
    await syncTask(oldTask, 'remove');
  }

  // 8b. Aktuelle Referenzen: Task hinzufügen/updaten
  await syncTask(task, 'update');
  for (const updated of updatedTasks) {
    await syncTask(updated, 'update');
  }

  return ok({ task, claimReleased, updatedTasks });
}

/**
 * Wendet Änderungen auf eine Task an.
 * @param {import('../core/table/parser.mjs').Task} task
 * @param {EditOptions} changes
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {import('../core/table/parser.mjs').Bug[]} bugs
 * @returns {import('../core/result.mjs').Result<void, {code: string}>}
 */
export function applyChanges(task, changes, tasks, bugs) {
  if (changes.status !== undefined) {
    if (!isValidStatus(changes.status)) {
      return err({ code: 'INVALID_STATUS', status: changes.status });
    }
    task.status = changes.status;
  }

  if (changes.beschreibung !== undefined) {
    task.beschreibung = changes.beschreibung;
  }

  if (changes.prio !== undefined) {
    task.prio = changes.prio;
  }

  if (changes.mvp !== undefined) {
    task.mvp = changes.mvp;
  }

  if (changes.deps !== undefined) {
    const depIds = changes.deps.split(',').map(d => d.trim()).filter(Boolean);

    // "-" bedeutet keine Dependencies
    if (depIds.length === 1 && depIds[0] === '-') {
      task.deps = [];
      return ok(undefined);
    }

    // Existenz prüfen
    for (const depId of depIds) {
      const exists = depId.startsWith('b')
        ? bugs.some(b => b.id === depId)
        : tasks.some(t => `#${t.id}` === depId || String(t.id) === depId.replace('#', ''));
      if (!exists) {
        return err({ code: 'DEPENDENCY_NOT_FOUND', dep: depId });
      }
    }

    // Zyklus-Erkennung (nur für Task-Dependencies)
    for (const depId of depIds) {
      if (depId.startsWith('b')) continue;
      if (wouldCreateCycle(String(task.id), depId, tasks)) {
        return err({ code: 'CYCLIC_DEPENDENCY', from: task.id, to: depId });
      }
    }

    task.deps = depIds;
  }

  // Spec-Handling (multi-value)
  if (changes.spec !== undefined) {
    const specValues = changes.spec.split(',').map(s => s.trim()).filter(Boolean);
    task.spec = (specValues.length === 1 && specValues[0] === '-') ? [] : specValues;
  }

  // Impl-Handling (multi-value)
  if (changes.impl !== undefined) {
    const implValues = changes.impl.split(',').map(i => i.trim()).filter(Boolean);
    task.impl = (implValues.length === 1 && implValues[0] === '-') ? [] : implValues;
  }

  return ok(undefined);
}

/**
 * @typedef {Object} EditOptions
 * @property {string} [status]
 * @property {string} [deps]
 * @property {string} [beschreibung]
 * @property {string} [prio]
 * @property {boolean} [mvp]
 * @property {string} [spec]
 * @property {string} [impl]
 */
