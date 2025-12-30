// Ziel: Tasks zu referenzierten Spec/Impl-Dateien synchronisieren
// Siehe: docs/tools/taskTool.md#task-duplikation

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ok } from '../core/result.mjs';
import { resolveSpecPath, resolveImplPath } from '../adapters/fs-task-adapter.mjs';
import { updateSourceTasks } from '../core/table/src-table-parser.mjs';
import { parseRow, parseTask } from '../core/table/parser.mjs';
import { buildTasksTable } from '../core/table/builder.mjs';
import { IMPL_TAGS } from '../core/table/schema.mjs';

/**
 * Synchronisiert eine Task zu ihren Spec- und Impl-Dateien.
 * @param {import('../core/table/parser.mjs').Task} task
 * @param {'add' | 'update' | 'remove'} operation
 * @returns {Promise<import('../core/result.mjs').Result<{updatedFiles: string[]}, {code: string}>>}
 */
export async function syncTask(task, operation) {
  const updatedFiles = [];

  // 1. Spec-Sync (Markdown) - über Array iterieren
  for (const specRef of task.spec) {
    if (specRef && specRef !== '-') {
      const specResult = await resolveSpecPath(specRef);
      if (specResult.ok) {
        try {
          const updated = await syncToFile(specResult.value, task, operation, 'markdown');
          if (updated) updatedFiles.push(specResult.value);
        } catch (error) {
          console.warn(`[sync] Spec sync warning: ${error.message}`);
        }
      } else {
        console.warn(`[sync] Spec not found: ${specRef} (${specResult.error.code})`);
      }
    }
  }

  // 2. Impl-Sync (TypeScript, nur bei [ändern] oder [fertig]) - über Array iterieren
  for (const implRef of task.impl) {
    if (implRef && implRef !== '-' && shouldSyncImpl(implRef)) {
      const implResult = await resolveImplPath(implRef);
      if (implResult.ok && implResult.value.path) {
        try {
          const updated = await syncToFile(implResult.value.path, task, operation, 'typescript');
          if (updated) updatedFiles.push(implResult.value.path);
        } catch (error) {
          console.warn(`[sync] Impl sync warning: ${error.message}`);
        }
      }
    }
  }

  return ok({ updatedFiles });
}

/**
 * Synchronisiert Task zu einer Datei (Markdown oder TypeScript).
 * @param {string} filePath - Absoluter Pfad zur Datei
 * @param {import('../core/table/parser.mjs').Task} task
 * @param {'add' | 'update' | 'remove'} operation
 * @param {'markdown' | 'typescript'} format
 * @returns {Promise<boolean>} - true wenn Datei geändert wurde
 */
async function syncToFile(filePath, task, operation, format) {
  if (!existsSync(filePath)) {
    console.warn(`[sync] File not found: ${filePath}`);
    return false;
  }

  const content = await readFile(filePath, 'utf-8');
  let updated;

  if (format === 'typescript') {
    updated = updateSourceTasks(content, [task], operation);
  } else {
    updated = updateMarkdownTasks(content, [task], operation);
  }

  if (updated !== content) {
    await writeFile(filePath, updated, 'utf-8');
    console.log(`[sync] ${operation} task #${task.id} in ${filePath}`);
    return true;
  }

  return false;
}

/**
 * Updated TASKS-Abschnitt in Markdown-Datei.
 * @param {string} content - Original Datei-Content
 * @param {import('../core/table/parser.mjs').Task[]} newTasks
 * @param {'add' | 'update' | 'remove'} operation
 * @returns {string} - Aktualisierter Datei-Content
 */
function updateMarkdownTasks(content, newTasks, operation) {
  const lines = content.split('\n');
  const section = findTasksSection(lines);

  let mergedTasks;

  if (section) {
    // Parse existing tasks
    const existingTasks = parseTasksFromSection(lines, section);
    mergedTasks = mergeTaskLists(existingTasks, newTasks, operation);

    if (mergedTasks.length === 0) {
      // Remove entire section if no tasks left
      lines.splice(section.headerIndex, section.tableEnd - section.headerIndex + 1);
    } else {
      // Replace table content
      const newTable = buildTasksTable(mergedTasks);
      const newTableLines = newTable.split('\n');
      lines.splice(
        section.tableStart,
        section.tableEnd - section.tableStart + 1,
        ...newTableLines
      );
    }
  } else if (operation !== 'remove') {
    // No existing section - append at end
    mergedTasks = newTasks;
    if (mergedTasks.length > 0) {
      const newSection = buildNewTasksSection(mergedTasks);
      lines.push('', newSection);
    }
  }

  return lines.join('\n');
}

/**
 * Findet den Tasks-Abschnitt in Markdown.
 * @param {string[]} lines
 * @returns {{ headerIndex: number, tableStart: number, tableEnd: number } | null}
 */
function findTasksSection(lines) {
  // Find "## Tasks" or "## TASKS" header
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (line === '## tasks' || line.startsWith('## tasks')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return null;

  // Find table start (first line starting with |)
  let tableStart = -1;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|')) {
      tableStart = i;
      break;
    }
    if (line.startsWith('##')) {
      // Next section before table
      return null;
    }
  }

  if (tableStart === -1) return null;

  // Find table end
  let tableEnd = tableStart;
  for (let i = tableStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|')) {
      tableEnd = i;
    } else if (line === '' || line.startsWith('##')) {
      break;
    }
  }

  return { headerIndex, tableStart, tableEnd };
}

/**
 * Parst Tasks aus einem gefundenen Abschnitt.
 * @param {string[]} lines
 * @param {{ tableStart: number, tableEnd: number }} section
 * @returns {import('../core/table/parser.mjs').Task[]}
 */
function parseTasksFromSection(lines, section) {
  const tasks = [];

  // Skip header row (tableStart) and separator (tableStart + 1)
  for (let i = section.tableStart + 2; i <= section.tableEnd; i++) {
    const cells = parseRow(lines[i]);
    const result = parseTask(cells, i + 1);
    if (result.ok) {
      tasks.push(result.value);
    }
  }

  return tasks;
}

/**
 * Baut einen neuen Tasks-Abschnitt.
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @returns {string}
 */
function buildNewTasksSection(tasks) {
  const table = buildTasksTable(tasks);
  return `## Tasks\n\n${table}`;
}

/**
 * Mergt zwei Task-Listen basierend auf Operation.
 * @param {import('../core/table/parser.mjs').Task[]} existing
 * @param {import('../core/table/parser.mjs').Task[]} incoming
 * @param {'add' | 'update' | 'remove'} operation
 * @returns {import('../core/table/parser.mjs').Task[]}
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

/**
 * Prüft ob Impl synchronisiert werden soll.
 * Nur bei [ändern] oder [fertig], nicht bei [neu].
 * @param {string} impl
 * @returns {boolean}
 */
export function shouldSyncImpl(impl) {
  const tag = parseImplTag(impl);
  return tag === '[ändern]' || tag === '[fertig]';
}

/**
 * Extrahiert Impl-Tag aus Impl-Referenz.
 * @param {string} impl - z.B. 'groupActivity.ts.selectActivity() [neu]'
 * @returns {string | null}
 */
export function parseImplTag(impl) {
  for (const tag of IMPL_TAGS) {
    if (impl.includes(tag)) {
      return tag;
    }
  }
  return null;
}

/**
 * Batch-Sync für mehrere Tasks.
 * @param {import('../core/table/parser.mjs').Task[]} tasks
 * @param {'add' | 'update' | 'remove'} operation
 * @returns {Promise<string[]>} - Liste der aktualisierten Dateien
 */
export async function syncTasks(tasks, operation) {
  const allUpdatedFiles = [];

  for (const task of tasks) {
    const result = await syncTask(task, operation);
    if (result.ok) {
      allUpdatedFiles.push(...result.value.updatedFiles);
    }
  }

  // Deduplizieren
  return [...new Set(allUpdatedFiles)];
}
