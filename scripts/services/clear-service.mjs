/**
 * Clear Service
 *
 * Löscht alle Tasks und Bugs aus der Task-Tabelle eines Dokuments.
 * Nutzt removeService für vollständige Synchronisation über alle Docs.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { ok, err, TaskErrorCode } from '../core/result.mjs';
import { parseTaskId, isBugId } from '../core/table/parser.mjs';
import { createFsTaskAdapter } from '../adapters/fs-task-adapter.mjs';

/**
 * Extrahiert Task- und Bug-IDs aus der Task-Tabelle eines Dokuments
 *
 * Die Task-Tabelle wird erkannt durch:
 * 1. "## Tasks" Header (optional, aber bevorzugt)
 * 2. Task-Tabellen-Header: | # | Status | Domain | ...
 *
 * @param {string} content - Datei-Inhalt
 * @returns {{ taskIds: number[], bugIds: string[] }}
 */
function extractIdsFromTable(content) {
  const taskIds = [];
  const bugIds = [];

  // Finde den Task-Tabellen-Abschnitt
  // Suche nach "## Tasks" Header oder Task-Tabellen-Header-Zeile
  const tasksHeaderIndex = content.indexOf('## Tasks');
  const tableHeaderIndex = content.search(/\|\s*#\s*\|\s*Status\s*\|/i);

  // Startpunkt: Der spätere von beiden (falls Tasks-Header vor Tabelle)
  let startIndex = -1;
  if (tasksHeaderIndex !== -1 && tableHeaderIndex !== -1) {
    startIndex = Math.max(tasksHeaderIndex, tableHeaderIndex);
  } else if (tableHeaderIndex !== -1) {
    startIndex = tableHeaderIndex;
  } else if (tasksHeaderIndex !== -1) {
    startIndex = tasksHeaderIndex;
  }

  if (startIndex === -1) {
    return { taskIds, bugIds }; // Keine Task-Tabelle gefunden
  }

  // Nur den Abschnitt nach dem Header parsen
  const tableSection = content.slice(startIndex);

  // Finde Tabellenzeilen: | 3278 | ... | oder | b4 | ... | oder | 117a | ...
  // Die erste Spalte enthält die ID (Zahlen, alphanumerische IDs, oder Bug-IDs)
  const tableRowRegex = /^\|\s*(\d+[a-z]?|b\d+)\s*\|/gm;

  let match;
  while ((match = tableRowRegex.exec(tableSection)) !== null) {
    const idRaw = match[1].trim();

    if (isBugId(idRaw)) {
      bugIds.push(idRaw);
    } else {
      const parsed = parseTaskId(idRaw);
      // Alle gültigen Task-IDs akzeptieren (Zahlen oder alphanumerische wie "117a")
      if (parsed !== null) {
        taskIds.push(parsed);
      }
    }
  }

  return { taskIds, bugIds };
}

/**
 * Erstellt einen Clear-Service
 *
 * @param {object} [options] - Optionen
 * @param {object} [options.taskAdapter] - Task-Adapter Instanz
 * @returns {object}
 */
export function createClearService(options = {}) {
  const taskAdapter = options.taskAdapter ?? createFsTaskAdapter();

  return {
    /**
     * Löscht alle Tasks und Bugs aus einem Dokument
     *
     * @param {string} docPath - Pfad zum Dokument (relativ oder absolut)
     * @param {object} opts - Optionen
     * @param {boolean} opts.dryRun - Vorschau ohne Speichern
     * @returns {Result}
     */
    clearDocument(docPath, opts = {}) {
      const { dryRun = false } = opts;

      // Pfad normalisieren
      const absolutePath = resolve(process.cwd(), docPath);
      const relativePath = relative(process.cwd(), absolutePath);

      // Validierung: Muss in docs/ liegen
      if (!relativePath.startsWith('docs/') && !relativePath.startsWith('docs\\')) {
        return err({
          code: TaskErrorCode.INVALID_FORMAT,
          message: `Dokument muss in docs/ liegen: ${relativePath}`
        });
      }

      // Validierung: Datei muss existieren
      if (!existsSync(absolutePath)) {
        return err({
          code: TaskErrorCode.TASK_NOT_FOUND,
          message: `Datei nicht gefunden: ${relativePath}`
        });
      }

      // Datei lesen
      let content;
      try {
        content = readFileSync(absolutePath, 'utf-8');
      } catch (e) {
        return err({
          code: TaskErrorCode.READ_FAILED,
          message: `Fehler beim Lesen: ${e.message}`
        });
      }

      // IDs aus Tabelle extrahieren
      const { taskIds, bugIds } = extractIdsFromTable(content);
      const totalCount = taskIds.length + bugIds.length;

      if (totalCount === 0) {
        return ok({
          success: true,
          docPath: relativePath,
          message: 'Keine Tasks oder Bugs in der Tabelle gefunden',
          deleted: [],
          failed: [],
          totalCount: 0,
          dryRun
        });
      }

      // Bei dry-run: Nur IDs zurückgeben
      if (dryRun) {
        return ok({
          success: true,
          docPath: relativePath,
          taskIds,
          bugIds,
          totalCount,
          dryRun: true
        });
      }

      // Batch-Löschung via taskAdapter (vermeidet Race Conditions)
      const allIds = [...taskIds, ...bugIds];
      const result = taskAdapter.bulkDeleteTasks(allIds, { dryRun: false });

      if (!result.ok) {
        return result;
      }

      return ok({
        success: result.value.failed.length === 0,
        docPath: relativePath,
        deleted: result.value.deleted,
        failed: result.value.failed,
        totalCount,
        docs: result.value.docs,
        dryRun
      });
    }
  };
}

// ============================================================================
// CLI Interface
// ============================================================================

/**
 * Parst CLI-Argumente für clear command
 */
export function parseArgs(argv) {
  const opts = {
    docPath: null,
    dryRun: false,
    json: false,
    quiet: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('-')) {
      opts.docPath = arg;
    }
  }

  return opts;
}

/**
 * Führt den clear command aus
 */
export function execute(opts, service = null) {
  const clearService = service ?? createClearService();

  if (!opts.docPath) {
    return err({
      code: TaskErrorCode.INVALID_FORMAT,
      message: 'Dokument-Pfad erforderlich (z.B. docs/features/Travel-System.md)'
    });
  }

  return clearService.clearDocument(opts.docPath, { dryRun: opts.dryRun });
}

/**
 * Zeigt Hilfe für clear command
 */
export function showHelp() {
  return `
Clear Command - Alle Tasks/Bugs aus einem Dokument löschen

USAGE:
  node scripts/task.mjs clear <DOC_PATH> [OPTIONS]

ARGUMENTE:
  <DOC_PATH>             Pfad zum Dokument in docs/ (z.B. docs/features/Travel-System.md)

OPTIONEN:
  -n, --dry-run          Vorschau ohne Löschen
  --json                 JSON-Ausgabe
  -q, --quiet            Kompakte Ausgabe
  -h, --help             Diese Hilfe anzeigen

VERHALTEN:
  1. Liest die Task-Tabelle am Ende des Dokuments
  2. Extrahiert alle Task-IDs (#123) und Bug-IDs (b4)
  3. Löscht jede ID via removeService:
     - Tasks: Aus Roadmap + allen Docs entfernt
     - Bugs: Aus Roadmap entfernt
     - Dependencies werden automatisch bereinigt
     - Status-Propagation wird ausgelöst

BEISPIELE:
  node scripts/task.mjs clear docs/features/Travel-System.md
  node scripts/task.mjs clear docs/features/encounter/Difficulty.md --dry-run
  node scripts/task.mjs clear docs/domain/Creature.md --json
`;
}

/**
 * Default Clear-Service Instanz
 */
export const defaultClearService = createClearService();
