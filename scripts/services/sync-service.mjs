/**
 * Sync Service
 *
 * Synchronisiert Task-Definitionen aus der Roadmap (Single Source of Truth)
 * in alle Feature-Docs.
 */

import { ok, err } from '../core/result.mjs';
import { defaultTaskAdapter } from '../adapters/fs-task-adapter.mjs';
import { findInconsistencies } from '../core/consistency/checker.mjs';

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Zeigt Hilfe für den sync-Command
 */
export function showHelp() {
  return `
Sync Command - Diskrepanzen zwischen Roadmap und Docs beheben

USAGE:
  node scripts/task.mjs sync [OPTIONS]

BESCHREIBUNG:
  Synchronisiert Task-Definitionen aus der Roadmap (Single Source of Truth)
  in alle Feature-Docs. Die Roadmap-Werte überschreiben die Doc-Werte.

OPTIONEN:
  -n, --dry-run      Vorschau ohne Änderungen speichern
  -l, --limit <n>    Maximal n Tasks synchronisieren
  -q, --quiet        Kompakte Ausgabe
  --json             JSON-Ausgabe
  -h, --help         Diese Hilfe anzeigen

BEISPIELE:
  node scripts/task.mjs sync                    # Alle Diskrepanzen beheben
  node scripts/task.mjs sync --dry-run          # Vorschau
  node scripts/task.mjs sync --limit 10         # Nur 10 Tasks
`;
}

/**
 * Parst CLI-Argumente
 */
export function parseArgs(args) {
  const opts = {
    dryRun: false,
    limit: 0,
    quiet: false,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-n' || arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '-l' || arg === '--limit') {
      opts.limit = parseInt(args[++i], 10) || 0;
    } else if (arg === '-q' || arg === '--quiet') {
      opts.quiet = true;
    } else if (arg === '--json') {
      opts.json = true;
    }
  }

  return opts;
}

/**
 * Führt den sync-Command aus
 */
export function execute(opts) {
  const { dryRun = false, limit = 0 } = opts;

  // 1. Alle Task-Definitionen laden
  const defsResult = defaultTaskAdapter.getAllTaskDefinitions();
  if (!defsResult.ok) {
    return defsResult;
  }

  // 2. Inkonsistenzen finden
  const inconsistencies = findInconsistencies(defsResult.value);

  if (inconsistencies.length === 0) {
    return ok({
      success: true,
      synced: 0,
      message: 'Keine Inkonsistenzen gefunden'
    });
  }

  // 3. Roadmap laden für aktuelle Werte
  const loadResult = defaultTaskAdapter.load();
  if (!loadResult.ok) {
    return loadResult;
  }

  const { itemMap } = loadResult.value;

  // 4. Unique Task-IDs sammeln (jede Task nur einmal syncen)
  const taskIdsToSync = [...new Set(inconsistencies.map(i => i.taskId))];
  const toProcess = limit > 0 ? taskIdsToSync.slice(0, limit) : taskIdsToSync;

  // 5. Jede Task synchronisieren
  const results = [];

  for (const taskId of toProcess) {
    const task = itemMap.get(taskId);
    if (!task) {
      results.push({ taskId, success: false, reason: 'Task nicht in Roadmap gefunden' });
      continue;
    }

    // Updates aus Roadmap-Task erstellen
    const updates = {
      status: task.status,
      beschreibung: task.beschreibung
    };

    // Task aktualisieren (synchronisiert automatisch alle Docs)
    const updateResult = defaultTaskAdapter.updateTask(taskId, updates, { dryRun });

    if (updateResult.ok) {
      const docsSynced = updateResult.value.docs?.length ?? 0;
      results.push({
        taskId,
        success: true,
        docsSynced,
        dryRun
      });
    } else {
      results.push({
        taskId,
        success: false,
        reason: updateResult.error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalDocsSynced = results.reduce((sum, r) => sum + (r.docsSynced || 0), 0);

  return ok({
    success: true,
    isSync: true,
    totalInconsistencies: inconsistencies.length,
    uniqueTasks: taskIdsToSync.length,
    processed: toProcess.length,
    synced: successCount,
    docsSynced: totalDocsSynced,
    dryRun,
    results
  });
}
