// Ziel: Markdown-Tabellen aus Task/Bug-Arrays generieren
// Siehe: docs/tools/taskTool.md#datenmodell
//
// Funktionen:
// - buildTasksTable(tasks) - Task-Array zu Markdown-Tabelle
// - buildBugsTable(bugs) - Bug-Array zu Markdown-Tabelle
// - formatRow(cells, widths, aligns) - Zeile mit Alignment formatieren
// - buildSeparator(widths, aligns) - Separator-Zeile (|:--|:--:|--:|)
// - calculateColumnWidths(headers, rows) - Max-Breiten berechnen
// - taskToCells(task) - Task zu Zellen-Array konvertieren
// - bugToCells(bug) - Bug zu Zellen-Array konvertieren

import { TASK_COLUMNS, BUG_COLUMNS, formatMultiValue } from './schema.mjs';

/**
 * Generiert eine Markdown-Tabelle aus Tasks.
 * @param {import('./parser.mjs').Task[]} tasks
 * @returns {string}
 */
export function buildTasksTable(tasks) {
  if (tasks.length === 0) return '';

  const columns = Object.values(TASK_COLUMNS);
  const headers = columns.map(c => c.header);
  const aligns = columns.map(c => c.align);

  // Alle Zeilen als Zellen-Arrays
  const rows = tasks.map(taskToCells);

  // Spaltenbreiten berechnen (inkl. Header)
  const widths = calculateColumnWidths(headers, rows);

  // Tabelle zusammenbauen
  const lines = [
    formatRow(headers, widths, aligns),
    buildSeparator(widths, aligns),
    ...rows.map(row => formatRow(row, widths, aligns)),
  ];

  return lines.join('\n');
}

/**
 * Generiert eine Markdown-Tabelle aus Bugs.
 * @param {import('./parser.mjs').Bug[]} bugs
 * @returns {string}
 */
export function buildBugsTable(bugs) {
  if (bugs.length === 0) return '';

  const columns = Object.values(BUG_COLUMNS);
  const headers = columns.map(c => c.header);
  const aligns = columns.map(c => c.align);

  // Alle Zeilen als Zellen-Arrays
  const rows = bugs.map(bugToCells);

  // Spaltenbreiten berechnen (inkl. Header)
  const widths = calculateColumnWidths(headers, rows);

  // Tabelle zusammenbauen
  const lines = [
    formatRow(headers, widths, aligns),
    buildSeparator(widths, aligns),
    ...rows.map(row => formatRow(row, widths, aligns)),
  ];

  return lines.join('\n');
}

/**
 * Formatiert eine Tabellenzeile mit korrektem Alignment.
 * @param {string[]} cells - Zell-Inhalte
 * @param {number[]} widths - Spaltenbreiten
 * @param {('left'|'center'|'right')[]} aligns - Alignments
 * @returns {string}
 */
export function formatRow(cells, widths, aligns) {
  const paddedCells = cells.map((cell, i) => {
    const width = widths[i];
    const align = aligns[i];
    const cellStr = String(cell);
    const padding = width - cellStr.length;

    if (padding <= 0) return cellStr;

    switch (align) {
      case 'right':
        return ' '.repeat(padding) + cellStr;
      case 'center': {
        const left = Math.floor(padding / 2);
        const right = padding - left;
        return ' '.repeat(left) + cellStr + ' '.repeat(right);
      }
      case 'left':
      default:
        return cellStr + ' '.repeat(padding);
    }
  });

  return '| ' + paddedCells.join(' | ') + ' |';
}

/**
 * Baut die Separator-Zeile mit Alignment-Markern.
 * @param {number[]} widths - Spaltenbreiten
 * @param {('left'|'center'|'right')[]} aligns - Alignments
 * @returns {string}
 */
export function buildSeparator(widths, aligns) {
  const separators = widths.map((width, i) => {
    const align = aligns[i];
    // Mindestens 3 Zeichen für den Separator
    const dashCount = Math.max(width, 3);

    switch (align) {
      case 'right':
        return '-'.repeat(dashCount - 1) + ':';
      case 'center':
        return ':' + '-'.repeat(dashCount - 2) + ':';
      case 'left':
      default:
        return ':' + '-'.repeat(dashCount - 1);
    }
  });

  return '|' + separators.join('|') + '|';
}

/**
 * Berechnet maximale Spaltenbreiten.
 * @param {string[]} headers - Header-Zeile
 * @param {string[][]} rows - Daten-Zeilen
 * @returns {number[]}
 */
export function calculateColumnWidths(headers, rows) {
  const widths = headers.map(h => h.length);

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cellLength = String(row[i]).length;
      if (cellLength > widths[i]) {
        widths[i] = cellLength;
      }
    }
  }

  return widths;
}

/**
 * Task zu Zellen-Array konvertieren.
 * @param {import('./parser.mjs').Task} task
 * @returns {string[]}
 */
export function taskToCells(task) {
  return [
    String(task.id),
    task.status,
    formatMultiValue(task.domain),  // Array zu String
    formatMultiValue(task.layer),   // Array zu String
    task.beschreibung,
    task.prio,
    task.mvp ? 'Ja' : 'Nein',
    task.deps.length > 0 ? task.deps.join(', ') : '-',
    formatMultiValue(task.spec),    // Array zu String
    formatMultiValue(task.impl),    // Array zu String
  ];
}

/**
 * Bug zu Zellen-Array konvertieren.
 * @param {import('./parser.mjs').Bug} bug
 * @returns {string[]}
 */
export function bugToCells(bug) {
  return [
    bug.id,
    bug.status,
    bug.beschreibung,
    bug.prio,
    bug.deps.length > 0 ? bug.deps.join(', ') : '-',
  ];
}
