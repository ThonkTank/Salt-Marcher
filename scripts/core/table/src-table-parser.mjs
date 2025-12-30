/**
 * Source File Task Table Parser
 *
 * Parst Task-Tabellen aus TypeScript/JavaScript-Kommentar-Headern.
 * Format: // | # | Status | ... | in Source-Dateien
 */

import { parseDocTaskLine, splitTableLine } from './parser.mjs';

// ============================================================================
// SECTION DETECTION
// ============================================================================

/**
 * Findet die TASKS: Section in einem Source-File
 *
 * @param {string[]} lines - Zeilen des Files
 * @returns {{ start: number, end: number, headerLine: number, separatorLine: number } | null}
 */
export function findTasksSection(lines) {
  let start = -1;
  let headerLine = -1;
  let separatorLine = -1;
  let end = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // TASKS: Marker finden
    if (trimmed === '// TASKS:') {
      start = i;
      continue;
    }

    // Nach TASKS: suchen wir Header und Separator
    if (start >= 0 && headerLine < 0) {
      // Header: // | # | Status | ...
      if (trimmed.startsWith('// |') && trimmed.includes('Status')) {
        headerLine = i;
        continue;
      }
    }

    if (headerLine >= 0 && separatorLine < 0) {
      // Separator: // |--:|:------:|...
      if (trimmed.startsWith('// |') && /\|[-:\s|]+\|/.test(trimmed)) {
        separatorLine = i;
        continue;
      }
    }

    // Task-Zeilen sammeln bis Section endet
    if (separatorLine >= 0) {
      // Noch in der Section?
      if (trimmed.startsWith('// |')) {
        end = i;
        continue;
      }

      // Leere Kommentarzeile oder anderer Kommentar = Section Ende
      if (trimmed === '//' || !trimmed.startsWith('//')) {
        break;
      }

      // Kommentar ohne Tabelle = Section Ende
      if (trimmed.startsWith('//') && !trimmed.startsWith('// |')) {
        break;
      }
    }
  }

  if (start < 0 || headerLine < 0 || separatorLine < 0) {
    return null;
  }

  return {
    start,
    headerLine,
    separatorLine,
    end: end >= 0 ? end : separatorLine
  };
}

// ============================================================================
// TABLE PARSING
// ============================================================================

/**
 * Entfernt den "// " Prefix von einer Zeile
 *
 * @param {string} line - Kommentierte Zeile
 * @returns {string} - Zeile ohne Prefix
 */
export function stripCommentPrefix(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('// ')) {
    return trimmed.slice(3);
  }
  if (trimmed.startsWith('//')) {
    return trimmed.slice(2);
  }
  return line;
}

/**
 * Parst die Task-Tabelle aus einem Source-File
 *
 * @param {string} content - Dateiinhalt
 * @returns {{ tasks: object[], section: object | null }}
 */
export function parseSrcTaskTable(content) {
  const lines = content.split('\n');
  const section = findTasksSection(lines);

  if (!section) {
    return { tasks: [], section: null };
  }

  const tasks = [];

  // Task-Zeilen parsen (nach Separator)
  for (let i = section.separatorLine + 1; i <= section.end; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed.startsWith('// |')) {
      continue;
    }

    // Prefix entfernen und als Markdown-Tabelle parsen
    const tableLine = stripCommentPrefix(trimmed);
    const task = parseDocTaskLine(tableLine);

    if (task) {
      task.lineIndex = i;
      tasks.push(task);
    }
  }

  return { tasks, section };
}

/**
 * Findet eine Task anhand ihrer ID im Source-File
 *
 * @param {string} content - Dateiinhalt
 * @param {number|string} taskId - Task-ID
 * @returns {{ task: object, lineIndex: number } | null}
 */
export function findTaskInSource(content, taskId) {
  const { tasks } = parseSrcTaskTable(content);
  const idStr = String(taskId);

  for (const task of tasks) {
    if (String(task.number) === idStr) {
      return { task, lineIndex: task.lineIndex };
    }
  }

  return null;
}

/**
 * Prüft ob ein Source-File eine bestimmte Task enthält
 *
 * @param {string} content - Dateiinhalt
 * @param {number|string} taskId - Task-ID
 * @returns {boolean}
 */
export function sourceContainsTask(content, taskId) {
  return findTaskInSource(content, taskId) !== null;
}
