/**
 * Source File Task Table Builder
 *
 * Baut Task-Tabellen als TypeScript/JavaScript-Kommentarblöcke.
 * Nutzt die existierenden Doc-Builder mit "// " Prefix.
 */

import { buildDocTaskLine, updateDocTaskLine } from './builder.mjs';
import { DocTableSchemaNew } from './schema.mjs';

// ============================================================================
// COMMENT HELPERS
// ============================================================================

/**
 * Fügt "// " Prefix zu einer Zeile hinzu
 *
 * @param {string} line - Zeile ohne Prefix
 * @returns {string} - Kommentierte Zeile
 */
export function addCommentPrefix(line) {
  return `// ${line}`;
}

/**
 * Entfernt "// " Prefix von einer Zeile
 *
 * @param {string} line - Kommentierte Zeile
 * @returns {string} - Zeile ohne Prefix
 */
export function removeCommentPrefix(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('// ')) {
    return trimmed.slice(3);
  }
  if (trimmed.startsWith('//')) {
    return trimmed.slice(2);
  }
  return line;
}

// ============================================================================
// LINE BUILDING
// ============================================================================

/**
 * Baut eine einzelne Task-Zeile als Kommentar
 *
 * @param {object} task - Task-Objekt mit allen Feldern
 * @returns {string} - "// | 123 | ⬜ | ... |"
 */
export function buildSrcTaskLine(task) {
  const line = buildDocTaskLine(task);
  return addCommentPrefix(line);
}

/**
 * Aktualisiert eine kommentierte Task-Zeile
 *
 * @param {string} line - Kommentierte Zeile "// | 123 | ... |"
 * @param {object} updates - Updates { status, beschreibung, ... }
 * @returns {string} - Aktualisierte kommentierte Zeile
 */
export function updateSrcTaskLine(line, updates) {
  const tableLine = removeCommentPrefix(line);
  const updatedLine = updateDocTaskLine(tableLine, updates);
  return addCommentPrefix(updatedLine);
}

// ============================================================================
// SECTION BUILDING
// ============================================================================

/**
 * Baut eine komplette TASKS: Section als Kommentarblock
 *
 * @param {object[]} tasks - Array von Task-Objekten
 * @returns {string[]} - Array von Zeilen (mit "// " Prefix)
 */
export function buildSrcTaskSection(tasks = []) {
  const lines = [
    '// TASKS:',
    addCommentPrefix(DocTableSchemaNew.headerText),
    addCommentPrefix(DocTableSchemaNew.separatorText)
  ];

  for (const task of tasks) {
    lines.push(buildSrcTaskLine(task));
  }

  return lines;
}

/**
 * Baut einen leeren TASKS: Header (ohne Tasks)
 *
 * @returns {string[]} - Array von Zeilen
 */
export function buildEmptySrcTaskSection() {
  return buildSrcTaskSection([]);
}

// ============================================================================
// SECTION CONSTANTS
// ============================================================================

/**
 * TASKS: Section Header-Text
 */
export const SRC_TASKS_MARKER = '// TASKS:';

/**
 * Kommentierter Tabellen-Header
 */
export const SRC_TABLE_HEADER = addCommentPrefix(DocTableSchemaNew.headerText);

/**
 * Kommentierter Tabellen-Separator
 */
export const SRC_TABLE_SEPARATOR = addCommentPrefix(DocTableSchemaNew.separatorText);
