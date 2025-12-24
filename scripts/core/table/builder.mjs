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
    domain: '-',
    layer: '-',
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
 * Baut eine Doc-Task-Zeile im neuen 10-Spalten-Format
 *
 * @param {object} task - Das Task-Objekt
 * @returns {string} - Die formatierte Zeile
 */
export function buildDocTaskLine(task) {
  const defaults = {
    status: TaskStatus.OPEN,
    domain: '-',
    layer: '-',
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

      // Newlines entfernen (verhindert Multi-Line-Tabellenzeilen)
      if (typeof value === 'string') {
        value = value.replace(/[\r\n]+/g, ' ').trim();
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
// Hilfsfunktion: Entfernt Newlines aus Strings
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(/[\r\n]+/g, ' ').trim();
  }
  return value;
}

export function updateDocTaskLine(line, updates, format = null) {
  const cells = line.split('|');

  // Legacy-Support: wenn updates ein String ist, ist es nur die Deps
  if (typeof updates === 'string') {
    updates = { deps: updates };
  }

  // Format automatisch erkennen
  const isNewFormat = format?.isNewFormat ?? (cells.length >= 12);

  if (isNewFormat && cells.length >= 12) {
    // Neues 10-Spalten-Format (identisch mit Roadmap):
    // cells[0]='' [1]=# [2]=Status [3]=Domain [4]=Layer [5]=Beschreibung [6]=Prio [7]=MVP [8]=Deps [9]=Spec [10]=Imp [11]=''
    if (updates.status !== undefined) cells[2] = ` ${sanitizeValue(updates.status)} `;
    if (updates.domain !== undefined) cells[3] = ` ${sanitizeValue(updates.domain)} `;
    if (updates.layer !== undefined) cells[4] = ` ${sanitizeValue(updates.layer)} `;
    if (updates.beschreibung !== undefined) cells[5] = ` ${sanitizeValue(updates.beschreibung)} `;
    if (updates.prio !== undefined) cells[6] = ` ${sanitizeValue(updates.prio)} `;
    if (updates.mvp !== undefined) cells[7] = ` ${sanitizeValue(updates.mvp)} `;
    if (updates.deps !== undefined) {
      const depsStr = Array.isArray(updates.deps) ? formatDeps(updates.deps) : updates.deps;
      cells[8] = ` ${sanitizeValue(depsStr)} `;
    }
    if (updates.spec !== undefined) cells[9] = ` ${sanitizeValue(updates.spec)} `;
    if (updates.imp !== undefined) cells[10] = ` ${sanitizeValue(updates.imp)} `;
  } else if (cells.length >= 7) {
    // Altes 6-Spalten-Format:
    // cells[0]='' [1]=# [2]=Beschreibung [3]=Prio [4]=MVP [5]=Deps [6]=Spec [7]=''
    if (updates.beschreibung !== undefined) cells[2] = ` ${sanitizeValue(updates.beschreibung)} `;
    if (updates.prio !== undefined) cells[3] = ` ${sanitizeValue(updates.prio)} `;
    if (updates.mvp !== undefined) cells[4] = ` ${sanitizeValue(updates.mvp)} `;
    if (updates.deps !== undefined) {
      const depsStr = Array.isArray(updates.deps) ? formatDeps(updates.deps) : updates.deps;
      cells[5] = ` ${sanitizeValue(depsStr)} `;
    }
    if (updates.spec !== undefined) cells[6] = ` ${sanitizeValue(updates.spec)} `;
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
 * Expandiert eine Task-Datenzeile von 6 auf 10 Spalten
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
  if (!format?.isOldFormat && cells.length >= 10) return line;

  // Altes Format: # | Beschreibung | Prio | MVP? | Deps | Spec
  const [number, beschreibung, prio, mvp, deps, spec] = cells;

  // Werte aus Roadmap holen (falls vorhanden)
  const status = roadmapTask?.status || TaskStatus.OPEN;
  const domain = roadmapTask?.domain || '-';
  const layer = roadmapTask?.layer || '-';
  const imp = roadmapTask?.imp || '-';

  // Neue Zeile: # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp.
  return `| ${number} | ${status} | ${domain} | ${layer} | ${beschreibung} | ${prio} | ${mvp} | ${deps} | ${spec} | ${imp} |`;
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

// ============================================================================
// TABLE INITIALIZATION
// ============================================================================

/**
 * Erstellt eine leere Task-Tabelle im 10-Spalten-Format
 *
 * @returns {string} - Die vollständige Tabelle (Header + Separator)
 */
export function buildEmptyTaskTable() {
  return [
    '',
    '## Tasks',
    '',
    DocTableSchemaNew.headerText,
    DocTableSchemaNew.separatorText
  ].join('\n');
}
