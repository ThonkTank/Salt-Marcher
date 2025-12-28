/**
 * Data Loader - Zentrales Laden von Task-Daten
 *
 * Extrahiert das gemeinsame loadData() Pattern aus allen Services.
 */

import { ok } from './result.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';

/**
 * Erstellt einen DataLoader mit zentraler Lade-Logik
 *
 * @param {import('../ports/task-port.mjs').TaskPort} [taskAdapter] - Optional: Task-Adapter
 * @returns {DataLoader}
 */
export function createDataLoader(taskAdapter = null) {
  const adapter = taskAdapter ?? createFsTaskAdapter();

  return {
    /**
     * Lädt alle Items (Tasks + Bugs)
     * @returns {import('./result.mjs').Result<{items: Array, itemMap: Map, tasks: Array, bugs: Array}>}
     */
    loadAll() {
      const result = adapter.load();
      if (!result.ok) return result;

      const { tasks, bugs, itemMap } = result.value;
      return ok({ items: [...tasks, ...bugs], itemMap, tasks, bugs });
    },

    /**
     * Gibt den Adapter zurück (für updateTask etc.)
     * @returns {import('../ports/task-port.mjs').TaskPort}
     */
    getAdapter() {
      return adapter;
    }
  };
}
