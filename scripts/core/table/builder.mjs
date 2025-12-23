/**
 * Table Line Builder
 *
 * Erstellt und aktualisiert Tabellenzeilen basierend auf Schemas.
 * Ersetzt die duplizierten Build/Update-Funktionen.
 */

import {
  RoadmapTaskSchema,
  BugTableSchema,
  DocTableSchemaNew,
  TaskStatus
} from './schema.mjs';
import { formatDeps, splitTableLine } from './parser.mjs';

// ============================================================================
// LINE BUILDING
// ============================================================================

/**
 * Baut eine Tabellenzeile aus einem Objekt
 *
 * @param {object} item - Das Item (Task/Bug)
 * @param {object} schema - Das Schema
 * @returns {string} - Die formatierte Zeile
 */
export function buildLine(item, schema) {
  const cells = schema.columns.map(col => {
    let value = item[col];

    // Dependencies formatieren
    if (col === 'deps' && Array.isArray(value)) {
      value = formatDeps(value);
    }

    // Defaults
    if (value === undefined || value === null || value === '') {
      value = '-';
    }

    return String(value);
  });

  return '| ' + cells.join(' | ') + ' |';
}

/**
 * Baut eine Roadmap-Task-Zeile
 *
 * @param {object} task - Das Task-Objekt
 * @returns {string} - Die formatierte Zeile
 */
export function buildTaskLine(task) {
  const defaults = {
    status: TaskStatus.OPEN,
    bereich: '-',
    beschreibung: '-',
    prio: 'mittel',
    mvp: 'Nein',
    deps: [],
    spec: '-',
    imp: '-'
  };

  return buildLine({ ...defaults, ...task }, RoadmapTaskSchema);
}

/**
 * Baut eine Bug-Zeile
 *
 * @param {object} bug - Das Bug-Objekt
 * @returns {string} - Die formatierte Zeile
 */
export function buildBugLine(bug) {
  const defaults = {
    status: TaskStatus.OPEN,
    beschreibung: '-',
    prio: 'hoch',
    deps: []
  };

  return buildLine({ ...defaults, ...bug }, BugTableSchema);
}

/**
 * Baut eine Doc-Task-Zeile im neuen 9-Spalten-Format
 *
 * @param {object} task - Das Task-Objekt
 * @returns {string} - Die formatierte Zeile
 */
export function buildDocTaskLine(task) {
  const defaults = {
    status: TaskStatus.OPEN,
    bereich: '-',
    beschreibung: '-',
    prio: 'mittel',
    mvp: 'Nein',
    deps: [],
    spec: '-',
    imp: '-'
  };

  return buildLine({ ...defaults, ...task }, DocTableSchemaNew);
}

// ============================================================================
// LINE UPDATING
// ============================================================================

/**
 * Aktualisiert eine Tabellenzeile mit neuen Werten
 *
 * @param {string} line - Die ursprüngliche Zeile
 * @param {object} updates - Die Updates { spaltenName: neuerWert }
 * @param {object} schema - Das Schema
 * @returns {string} - Die aktualisierte Zeile
 */
export function updateLine(line, updates, schema) {
  const cells = line.split('|');

  // Schema-Indices zu Zellen-Indices (+1 wegen führendem |)
  for (const [name, schemaIndex] of Object.entries(schema.indices)) {
    if (updates[name] !== undefined) {
      let value = updates[name];

      // Dependencies formatieren
      if (name === 'deps' && Array.isArray(value)) {
        value = formatDeps(value);
      }

      // Zellen-Index berechnen (Schema-Index + 1 wegen führendem |)
      const cellIndex = schemaIndex + 1;
      if (cellIndex < cells.length) {
        cells[cellIndex] = ` ${value} `;
      }
    }
  }

  return cells.join('|');
}

/**
 * Aktualisiert eine Roadmap-Task-Zeile
 *
 * @param {string} line - Die ursprüngliche Zeile
 * @param {object} updates - Die Updates
 * @returns {string} - Die aktualisierte Zeile
 */
export function updateTaskLine(line, updates) {
  return updateLine(line, updates, RoadmapTaskSchema);
}

/**
 * Aktualisiert eine Bug-Zeile
 *
 * @param {string} line - Die ursprüngliche Zeile
 * @param {object} updates - Die Updates
 * @returns {string} - Die aktualisierte Zeile
 */
export function updateBugLine(line, updates) {
  return updateLine(line, updates, BugTableSchema);
}

/**
 * Aktualisiert eine Doc-Task-Zeile
 *
 * @param {string} line - Die ursprüngliche Zeile
 * @param {object} updates - Die Updates
 * @param {object} [format] - Optional Format-Info (für altes vs neues Format)
 * @returns {string} - Die aktualisierte Zeile
 */
export function updateDocTaskLine(line, updates, format = null) {
  const cells = line.split('|');

  // Legacy-Support: wenn updates ein String ist, ist es nur die Deps
  if (typeof updates === 'string') {
    updates = { deps: updates };
  }

  // Format automatisch erkennen
  const isNewFormat = format?.isNewFormat ?? (cells.length >= 11);

  if (isNewFormat && cells.length >= 11) {
    // Neues 9-Spalten-Format (identisch mit Roadmap):
    // cells[0]='' [1]=# [2]=Status [3]=Bereich [4]=Beschreibung [5]=Prio [6]=MVP [7]=Deps [8]=Spec [9]=Imp [10]=''
    if (updates.status !== undefined) cells[2] = ` ${updates.status} `;
    if (updates.bereich !== undefined) cells[3] = ` ${updates.bereich} `;
    if (updates.beschreibung !== undefined) cells[4] = ` ${updates.beschreibung} `;
    if (updates.prio !== undefined) cells[5] = ` ${updates.prio} `;
    if (updates.mvp !== undefined) cells[6] = ` ${updates.mvp} `;
    if (updates.deps !== undefined) {
      const depsStr = Array.isArray(updates.deps) ? formatDeps(updates.deps) : updates.deps;
      cells[7] = ` ${depsStr} `;
    }
    if (updates.spec !== undefined) cells[8] = ` ${updates.spec} `;
    if (updates.imp !== undefined) cells[9] = ` ${updates.imp} `;
  } else if (cells.length >= 7) {
    // Altes 6-Spalten-Format:
    // cells[0]='' [1]=# [2]=Beschreibung [3]=Prio [4]=MVP [5]=Deps [6]=Spec [7]=''
    if (updates.beschreibung !== undefined) cells[2] = ` ${updates.beschreibung} `;
    if (updates.prio !== undefined) cells[3] = ` ${updates.prio} `;
    if (updates.mvp !== undefined) cells[4] = ` ${updates.mvp} `;
    if (updates.deps !== undefined) {
      const depsStr = Array.isArray(updates.deps) ? formatDeps(updates.deps) : updates.deps;
      cells[5] = ` ${depsStr} `;
    }
    if (updates.spec !== undefined) cells[6] = ` ${updates.spec} `;
  }

  return cells.join('|');
}

// ============================================================================
// FORMAT EXPANSION
// ============================================================================

/**
 * Expandiert den Tabellen-Header von 6 auf 9 Spalten
 *
 * @param {string} headerLine - Aktuelle Header-Zeile
 * @param {object} [format] - Format-Info
 * @returns {string} - Erweiterte Header-Zeile
 */
export function expandDocTableHeader(headerLine, format = null) {
  // Bereits im neuen Format?
  if (format?.isNewFormat) return headerLine;

  // Format prüfen wenn nicht übergeben
  if (!format) {
    const cells = splitTableLine(headerLine);
    const isOld = cells.length === 6 && !cells.map(c => c.toLowerCase()).includes('status');
    if (!isOld) return headerLine;
  }

  return DocTableSchemaNew.headerText;
}

/**
 * Expandiert die Separator-Zeile
 *
 * @param {string} separatorLine - Aktuelle Separator-Zeile
 * @param {number} [targetColumns=9] - Ziel-Spaltenanzahl
 * @returns {string} - Erweiterte Separator-Zeile
 */
export function expandDocSeparatorLine(separatorLine, targetColumns = 9) {
  const cells = separatorLine.split('|').filter(c => /[\s:-]+/.test(c));

  if (cells.length >= targetColumns) return separatorLine;

  // Standard-Separator verwenden
  return DocTableSchemaNew.separatorText;
}

/**
 * Expandiert eine Task-Datenzeile von 6 auf 9 Spalten
 *
 * @param {string} line - Aktuelle Datenzeile
 * @param {object} [roadmapTask] - Entsprechende Task aus der Roadmap
 * @param {object} [format] - Format-Info
 * @returns {string} - Erweiterte Datenzeile
 */
export function expandDocTaskLine(line, roadmapTask = null, format = null) {
  // Bereits im neuen Format?
  if (format?.isNewFormat) return line;

  const cells = splitTableLine(line);
  if (cells.length < 6) return line;

  // Prüfen ob altes Format
  if (!format?.isOldFormat && cells.length >= 9) return line;

  // Altes Format: # | Beschreibung | Prio | MVP? | Deps | Spec
  const [number, beschreibung, prio, mvp, deps, spec] = cells;

  // Werte aus Roadmap holen (falls vorhanden)
  const status = roadmapTask?.status || TaskStatus.OPEN;
  const bereich = roadmapTask?.bereich || '-';
  const imp = roadmapTask?.imp || '-';

  // Neue Zeile: # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp.
  return `| ${number} | ${status} | ${bereich} | ${beschreibung} | ${prio} | ${mvp} | ${deps} | ${spec} | ${imp} |`;
}

// ============================================================================
// HEADER CONSTANTS
// ============================================================================

/**
 * Doc-Tabellen Header im 9-Spalten-Format
 */
export const DOC_TABLE_HEADER_9COL = DocTableSchemaNew.headerText;

/**
 * Doc-Tabellen Separator im 9-Spalten-Format
 */
export const DOC_TABLE_SEPARATOR_9COL = DocTableSchemaNew.separatorText;
