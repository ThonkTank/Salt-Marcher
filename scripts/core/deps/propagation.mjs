/**
 * Status Propagation Logic
 *
 * Berechnet Status-Änderungen die sich aus Dependency-Beziehungen ergeben.
 */

import { TaskStatus } from '../table/schema.mjs';
import { normalizeId, areDepsResolved, findDependents } from '../task/types.mjs';
import { createTaskMutation } from '../task/mutations.mjs';

/**
 * @typedef {object} PropagationEffect
 * @property {string|number} taskId - Die betroffene Task-ID
 * @property {string} oldStatus - Alter Status
 * @property {string} newStatus - Neuer Status
 * @property {string} reason - Grund für die Änderung
 */

/**
 * Berechnet welche Tasks blockiert werden müssen
 * wenn eine Task nicht mehr ✅ ist
 *
 * @param {string|number} changedTaskId - Die geänderte Task-ID
 * @param {string} newStatus - Der neue Status der Task
 * @param {object[]} allItems - Alle Tasks/Bugs
 * @param {Map<string|number, object>} itemMap - Map von ID zu Item
 * @returns {PropagationEffect[]} - Die Propagations-Effekte
 */
export function calculateBlockedPropagation(changedTaskId, newStatus, allItems, itemMap) {
  const effects = [];

  // Nur propagieren wenn Status von ✅ auf etwas anderes wechselt
  // oder wenn wir zu ✅ wechseln (Entblockierung)
  const isUnblocking = newStatus === TaskStatus.DONE;

  // Finde alle Tasks die von dieser Task abhängen
  const dependents = findDependents(changedTaskId, allItems);

  for (const dependent of dependents) {
    // Aktuelle Task aus Map holen (für aktuellen Status)
    const currentItem = itemMap.get(dependent.number);
    if (!currentItem) continue;

    if (isUnblocking) {
      // ✅ Tasks werden bei Entblockierung nicht verändert
      if (currentItem.status === TaskStatus.DONE) continue;

      // Prüfen ob alle Dependencies jetzt erfüllt sind
      // Wir müssen die geänderte Task als ✅ betrachten
      const tempMap = new Map(itemMap);
      const changedItem = tempMap.get(changedTaskId);
      if (changedItem) {
        tempMap.set(changedTaskId, { ...changedItem, status: TaskStatus.DONE });
      }

      if (areDepsResolved(currentItem, tempMap)) {
        // Task kann entblockt werden (⛔ -> ⬜)
        if (currentItem.status === TaskStatus.BLOCKED) {
          effects.push({
            taskId: dependent.number,
            oldStatus: currentItem.status,
            newStatus: TaskStatus.OPEN,
            reason: `Alle Dependencies von #${changedTaskId} erfüllt`
          });
        }
      }
    } else {
      // Dependency nicht mehr erfüllt - Blockierung oder Konformitätsverlust prüfen
      if (!areDepsResolved(currentItem, itemMap)) {
        if (currentItem.status === TaskStatus.DONE) {
          // ✅ Tasks werden auf 🔶 gesetzt (nicht mehr konform)
          effects.push({
            taskId: dependent.number,
            oldStatus: currentItem.status,
            newStatus: TaskStatus.PARTIAL,
            reason: `Dependency #${changedTaskId} ist nicht mehr erfüllt`
          });
        } else if (currentItem.status !== TaskStatus.BLOCKED) {
          // Andere Tasks werden blockiert
          effects.push({
            taskId: dependent.number,
            oldStatus: currentItem.status,
            newStatus: TaskStatus.BLOCKED,
            reason: `Dependency #${changedTaskId} ist nicht mehr erfüllt`
          });
        }
      }
    }
  }

  return effects;
}

/**
 * Berechnet transitive Blockierung
 *
 * Wenn A blockiert wird, müssen alle Tasks die von A abhängen auch blockiert werden.
 *
 * @param {PropagationEffect[]} directEffects - Direkte Blockierungen
 * @param {object[]} allItems - Alle Tasks/Bugs
 * @param {Map<string|number, object>} itemMap - Map von ID zu Item
 * @returns {PropagationEffect[]} - Alle Effekte (inkl. transitiver)
 */
export function calculateTransitivePropagation(directEffects, allItems, itemMap) {
  const allEffects = [...directEffects];
  const processedIds = new Set(directEffects.map(e => normalizeId(e.taskId)));

  // Queue für transitive Verarbeitung
  const queue = directEffects.filter(e => e.newStatus === TaskStatus.BLOCKED);

  while (queue.length > 0) {
    const effect = queue.shift();

    // Finde alle Tasks die von dieser blockierten Task abhängen
    const dependents = findDependents(effect.taskId, allItems);

    for (const dependent of dependents) {
      const depIdStr = normalizeId(dependent.number);
      if (processedIds.has(depIdStr)) continue;

      // ✅ Tasks werden nicht verändert
      if (dependent.status === TaskStatus.DONE) continue;

      // Schon blockiert?
      if (dependent.status === TaskStatus.BLOCKED) continue;

      const transitiveEffect = {
        taskId: dependent.number,
        oldStatus: dependent.status,
        newStatus: TaskStatus.BLOCKED,
        reason: `Transitiv blockiert durch #${effect.taskId}`
      };

      allEffects.push(transitiveEffect);
      processedIds.add(depIdStr);
      queue.push(transitiveEffect);
    }
  }

  return allEffects;
}

/**
 * Berechnet alle Propagations-Effekte für eine Status-Änderung
 *
 * @param {string|number} changedTaskId - Die geänderte Task-ID
 * @param {string} newStatus - Der neue Status
 * @param {object[]} allItems - Alle Tasks/Bugs
 * @param {Map<string|number, object>} itemMap - Map von ID zu Item
 * @returns {PropagationEffect[]} - Alle Propagations-Effekte
 */
export function calculateAllPropagation(changedTaskId, newStatus, allItems, itemMap) {
  const directEffects = calculateBlockedPropagation(changedTaskId, newStatus, allItems, itemMap);
  return calculateTransitivePropagation(directEffects, allItems, itemMap);
}

/**
 * Konvertiert Propagations-Effekte zu Mutationen
 *
 * @param {PropagationEffect[]} effects - Die Effekte
 * @param {Map<string|number, object>} itemMap - Map von ID zu Item
 * @returns {Array<{mutation: object, error: object|null}>} - Mutationen mit optionalen Fehlern
 */
export function effectsToMutations(effects, itemMap) {
  return effects.map(effect => {
    const item = itemMap.get(effect.taskId);
    if (!item) {
      return { mutation: null, error: { taskId: effect.taskId, message: 'Item nicht gefunden' } };
    }

    const mutation = createTaskMutation(item)
      .setStatus(effect.newStatus);

    const result = mutation.build();
    if (!result.ok) {
      return { mutation: null, error: { taskId: effect.taskId, ...result.error } };
    }

    return { mutation: result.value, error: null };
  });
}
