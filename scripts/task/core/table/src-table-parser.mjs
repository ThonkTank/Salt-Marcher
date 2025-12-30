// Ziel: TASKS-Block in TypeScript-Datei-Headern parsen und updaten
// Siehe: docs/tools/taskTool.md#automatismen

import { parseRow, parseTask } from './parser.mjs';
import { TASK_COLUMNS } from './schema.mjs';
import { formatRow, buildSeparator, calculateColumnWidths, taskToCells } from './builder.mjs';

/**
 * Format des TASKS-Blocks in TypeScript-Dateien:
 *
 * // TASKS:
 * // | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
 * // |--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
 * // | 14 | ⬜ | Enc | srv | Task-Beschr. | hoch | Ja | - | ... | ... |
 */

/**
 * Findet den TASKS-Kommentarblock in TypeScript-Content.
 * @param {string} content - TypeScript-Datei-Content
 * @returns {{ startLine: number, endLine: number, headerLine: number } | null}
 */
export function findTasksBlock(content) {
  const lines = content.split('\n');

  // Find "// TASKS:" line
  let headerLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '// TASKS:') {
      headerLine = i;
      break;
    }
  }

  if (headerLine === -1) return null;

  // Find block extent (consecutive // lines with table content)
  const startLine = headerLine;
  let endLine = headerLine;

  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Block continues while we have comment lines with | (table rows)
    if (line.startsWith('//') && line.includes('|')) {
      endLine = i;
    } else if (line === '//' || line === '') {
      // Empty comment line or empty line - block might end here
      // Check if next non-empty line is still part of block
      continue;
    } else {
      // Non-comment line or comment without table - block ends
      break;
    }
  }

  return { startLine, endLine, headerLine };
}

/**
 * Parst TASKS-Block aus TypeScript-Datei-Content.
 * @param {string} content - TypeScript-Datei-Content
 * @returns {{ tasks: import('./parser.mjs').Task[], startLine: number, endLine: number } | null}
 */
export function parseSourceTasks(content) {
  const block = findTasksBlock(content);
  if (!block) return null;

  const lines = content.split('\n');
  const tasks = [];

  // Skip header line (// TASKS:) and find table content
  let dataStarted = false;

  for (let i = block.headerLine + 1; i <= block.endLine; i++) {
    const line = lines[i];
    // Remove leading "// " to get pure table row
    const tableRow = line.replace(/^\/\/\s*/, '');

    if (!tableRow.startsWith('|')) continue;

    // Skip header row (contains "Status" and "Domain")
    if (tableRow.includes('Status') && tableRow.includes('Domain')) {
      continue;
    }

    // Skip separator row (|--:|:---:|...)
    if (tableRow.match(/^\|[-:|]+\|$/)) {
      dataStarted = true;
      continue;
    }

    if (!dataStarted) continue;

    // Parse data row
    const cells = parseRow(tableRow);
    const taskResult = parseTask(cells, i + 1); // 1-based line number

    if (taskResult.ok) {
      tasks.push(taskResult.value);
    }
  }

  return {
    tasks,
    startLine: block.startLine,
    endLine: block.endLine,
  };
}

/**
 * Generiert TASKS-Block als Kommentar-String.
 * @param {import('./parser.mjs').Task[]} tasks
 * @returns {string}
 */
export function buildTasksComment(tasks) {
  if (tasks.length === 0) return '';

  const columns = Object.values(TASK_COLUMNS);
  const headers = columns.map(c => c.header);
  const aligns = columns.map(c => c.align);

  const rows = tasks.map(taskToCells);
  const widths = calculateColumnWidths(headers, rows);

  // Build table lines
  const tableLines = [
    formatRow(headers, widths, aligns),
    buildSeparator(widths, aligns),
    ...rows.map(row => formatRow(row, widths, aligns)),
  ];

  // Prefix each line with "// "
  const commentLines = [
    '// TASKS:',
    ...tableLines.map(line => '// ' + line),
  ];

  return commentLines.join('\n');
}

/**
 * Updated TASKS-Block in TypeScript-Datei.
 * @param {string} content - Original Datei-Content
 * @param {import('./parser.mjs').Task[]} newTasks - Tasks zum Hinzufügen/Aktualisieren/Entfernen
 * @param {'add' | 'update' | 'remove'} operation
 * @returns {string} - Aktualisierter Datei-Content
 */
export function updateSourceTasks(content, newTasks, operation = 'update') {
  const lines = content.split('\n');
  const existingBlock = parseSourceTasks(content);

  let mergedTasks;

  if (existingBlock) {
    // Merge based on operation
    mergedTasks = mergeTaskLists(existingBlock.tasks, newTasks, operation);

    // Replace existing block
    const newBlock = buildTasksComment(mergedTasks);

    if (mergedTasks.length === 0) {
      // Remove entire block if no tasks left
      lines.splice(existingBlock.startLine, existingBlock.endLine - existingBlock.startLine + 1);
    } else {
      const newBlockLines = newBlock.split('\n');
      lines.splice(
        existingBlock.startLine,
        existingBlock.endLine - existingBlock.startLine + 1,
        ...newBlockLines
      );
    }
  } else if (operation !== 'remove') {
    // No existing block - find insertion point after "// Siehe:" line
    mergedTasks = newTasks;
    const newBlock = buildTasksComment(mergedTasks);

    if (mergedTasks.length > 0) {
      const insertIndex = findInsertionPoint(lines);
      // Add empty comment line before TASKS block
      lines.splice(insertIndex, 0, '//', ...newBlock.split('\n'));
    }
  }

  return lines.join('\n');
}

/**
 * Findet die Einfügeposition für einen neuen TASKS-Block.
 * Nach "// Siehe:" Zeile und eventueller Pipeline-Beschreibung.
 * @param {string[]} lines
 * @returns {number}
 */
function findInsertionPoint(lines) {
  let sieheLineIndex = -1;
  let lastHeaderCommentIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('// Siehe:')) {
      sieheLineIndex = i;
    }

    // Track consecutive header comments after Siehe
    if (line.startsWith('//') && sieheLineIndex >= 0) {
      lastHeaderCommentIndex = i;
    } else if (!line.startsWith('//') && sieheLineIndex >= 0) {
      // First non-comment line after Siehe
      break;
    }
  }

  // Insert after last header comment, or after Siehe, or at line 3
  if (lastHeaderCommentIndex >= 0) {
    return lastHeaderCommentIndex + 1;
  }
  if (sieheLineIndex >= 0) {
    return sieheLineIndex + 1;
  }
  return 3; // Default: after first two header lines
}

/**
 * Mergt zwei Task-Listen basierend auf Operation.
 * @param {import('./parser.mjs').Task[]} existing
 * @param {import('./parser.mjs').Task[]} incoming
 * @param {'add' | 'update' | 'remove'} operation
 * @returns {import('./parser.mjs').Task[]}
 */
function mergeTaskLists(existing, incoming, operation) {
  const existingMap = new Map(existing.map(t => [t.id, t]));

  for (const task of incoming) {
    switch (operation) {
      case 'add':
      case 'update':
        existingMap.set(task.id, task);
        break;
      case 'remove':
        existingMap.delete(task.id);
        break;
    }
  }

  // Sort by ID
  return [...existingMap.values()].sort((a, b) => a.id - b.id);
}
