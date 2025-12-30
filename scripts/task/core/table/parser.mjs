// Ziel: Markdown-Tabellen aus Development-Roadmap.md parsen
// Siehe: docs/tools/taskTool.md#datenmodell
//
// Funktionen:
// - parseTasks(content) - Task-Tabelle aus Roadmap parsen
// - parseBugs(content) - Bug-Tabelle aus Roadmap parsen
// - findTable(content, sectionHeader) - Tabelle nach Section-Header finden
// - parseRow(row) - Einzelne Tabellenzeile in Zellen splitten
// - parseTask(cells, lineNumber) - Zellen zu Task-Objekt konvertieren
// - parseBug(cells, lineNumber) - Zellen zu Bug-Objekt konvertieren
// - parseDeps(depsString) - Dependencies-String zu Array parsen
// - parseDomain(domainString) - Domain-String zu Array parsen
// - parseLayer(layerString) - Layer-String zu Array parsen

import { ok, err } from '../result.mjs';
import { parseMultiValue } from './schema.mjs';

/**
 * Parst die Tasks-Tabelle aus dem Roadmap-Content.
 * @param {string} content - Vollständiger Markdown-Content
 * @returns {import('../result.mjs').Result<Task[], {code: string, message: string}>}
 */
export function parseTasks(content) {
  const table = findTable(content, '## 📋 Tasks');
  if (!table) {
    return err({ code: 'TABLE_NOT_FOUND', message: 'Tasks-Tabelle nicht gefunden' });
  }

  // Header (Zeile 0) und Separator (Zeile 1) überspringen
  const dataRows = table.rows.slice(2);
  const tasks = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = parseRow(dataRows[i]);
    // Zeile 0-basiert in rows + 2 für Header/Separator + startLine für absolute Position
    const lineNumber = table.startLine + 2 + i + 1; // +1 für 1-basierte Zeilennummern

    const taskResult = parseTask(cells, lineNumber);
    if (!taskResult.ok) {
      return taskResult;
    }
    tasks.push(taskResult.value);
  }

  return ok(tasks);
}

/**
 * Parst die Bugs-Tabelle aus dem Roadmap-Content.
 * @param {string} content - Vollständiger Markdown-Content
 * @returns {import('../result.mjs').Result<Bug[], {code: string, message: string}>}
 */
export function parseBugs(content) {
  const table = findTable(content, '## 🐛 Bugs');
  if (!table) {
    // Keine Bugs ist kein Fehler - einfach leere Liste
    return ok([]);
  }

  // Header (Zeile 0) und Separator (Zeile 1) überspringen
  const dataRows = table.rows.slice(2);
  const bugs = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = parseRow(dataRows[i]);
    const lineNumber = table.startLine + 2 + i + 1;

    const bugResult = parseBug(cells, lineNumber);
    if (!bugResult.ok) {
      return bugResult;
    }
    bugs.push(bugResult.value);
  }

  return ok(bugs);
}

/**
 * Findet eine Tabelle nach Section-Header.
 * @param {string} content - Vollständiger Markdown-Content
 * @param {string} sectionHeader - z.B. '## 📋 Tasks'
 * @returns {{ startLine: number, endLine: number, rows: string[] } | null}
 */
export function findTable(content, sectionHeader) {
  const lines = content.split('\n');

  // Section-Header finden
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(sectionHeader)) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return null;

  // Erste Tabellenzeile nach Header finden (beginnt mit |)
  let startLine = -1;
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|')) {
      startLine = i;
      break;
    }
    // Wenn wir einen anderen Section-Header treffen, gibt es keine Tabelle
    if (line.startsWith('##')) return null;
  }

  if (startLine === -1) return null;

  // Tabellen-Ende finden (Leerzeile oder nächster ## Header)
  let endLine = startLine;
  const rows = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();

    // Tabelle endet bei Leerzeile oder neuem Section-Header
    if (line === '' || line.startsWith('##')) {
      break;
    }

    // Nur Zeilen mit | sind Tabellenzeilen
    if (line.startsWith('|')) {
      rows.push(lines[i]);
      endLine = i;
    }
  }

  return { startLine, endLine, rows };
}

/**
 * Parst eine Tabellenzeile in Zellen.
 * @param {string} row - Markdown-Tabellenzeile
 * @returns {string[]}
 */
export function parseRow(row) {
  // Führende/trailing | und Whitespace entfernen
  let trimmed = row.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);

  // Split by | aber escaped pipes (\|) berücksichtigen
  // Temporär escaped pipes ersetzen
  const placeholder = '\x00PIPE\x00';
  const escaped = trimmed.replace(/\\\|/g, placeholder);
  const cells = escaped.split('|').map(cell =>
    cell.replace(new RegExp(placeholder, 'g'), '|').trim()
  );

  return cells;
}

/**
 * Parst Dependencies-String zu Array.
 * @param {string} depsString - z.B. '#10, #11, b1' oder '-'
 * @returns {string[]}
 */
export function parseDeps(depsString) {
  if (!depsString || depsString.trim() === '-') {
    return [];
  }
  return depsString.split(',').map(d => d.trim()).filter(Boolean);
}

/**
 * Konvertiert Zellen-Array zu Task-Objekt.
 * @param {string[]} cells - Zellen aus parseRow
 * @param {number} lineNumber - Zeilennummer im Markdown
 * @returns {import('../result.mjs').Result<Task, {code: string, message: string, lineNumber: number}>}
 */
export function parseTask(cells, lineNumber) {
  // Erwartete Spalten: #, Status, Domain, Layer, Beschreibung, Prio, MVP?, Deps, Spec, Imp.
  if (cells.length < 10) {
    return err({
      code: 'INVALID_ROW',
      message: `Task-Zeile hat nur ${cells.length} Spalten, erwartet 10`,
      lineNumber,
    });
  }

  const [idStr, status, domain, layer, beschreibung, prio, mvpStr, deps, spec, impl] = cells;

  // ID parsen
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return err({
      code: 'INVALID_ID',
      message: `Ungültige Task-ID: "${idStr}"`,
      lineNumber,
    });
  }

  // MVP parsen (Ja/Nein)
  const mvp = mvpStr.toLowerCase() === 'ja';

  return ok({
    id,
    status,
    domain: parseDomain(domain),
    layer: parseLayer(layer),
    beschreibung,
    prio,
    mvp,
    deps: parseDeps(deps),
    spec: parseMultiValue(spec),
    impl: parseMultiValue(impl),
    lineNumber,
  });
}

/**
 * Konvertiert Zellen-Array zu Bug-Objekt.
 * @param {string[]} cells - Zellen aus parseRow
 * @param {number} lineNumber - Zeilennummer im Markdown
 * @returns {import('../result.mjs').Result<Bug, {code: string, message: string, lineNumber: number}>}
 */
export function parseBug(cells, lineNumber) {
  // Erwartete Spalten: b#, Status, Beschreibung, Prio, Deps
  if (cells.length < 5) {
    return err({
      code: 'INVALID_ROW',
      message: `Bug-Zeile hat nur ${cells.length} Spalten, erwartet 5`,
      lineNumber,
    });
  }

  const [id, status, beschreibung, prio, deps] = cells;

  // ID validieren (muss mit 'b' beginnen)
  if (!id.startsWith('b')) {
    return err({
      code: 'INVALID_BUG_ID',
      message: `Ungültige Bug-ID: "${id}" (muss mit 'b' beginnen)`,
      lineNumber,
    });
  }

  return ok({
    id,
    status,
    beschreibung,
    prio,
    deps: parseDeps(deps),
    lineNumber,
  });
}

/**
 * @typedef {Object} Task
 * @property {number} id
 * @property {string} status
 * @property {string[]} domain - Kann mehrere Domains enthalten (komma-separiert in Tabelle)
 * @property {string[]} layer - Kann mehrere Layers enthalten (komma-separiert in Tabelle)
 * @property {string} beschreibung
 * @property {string} prio
 * @property {boolean} mvp
 * @property {string[]} deps
 * @property {string[]} spec - Kann mehrere Specs enthalten (komma-separiert in Tabelle)
 * @property {string[]} impl - Kann mehrere Impls enthalten (komma-separiert in Tabelle)
 * @property {number} lineNumber
 */

/**
 * Parst Domain-String zu Array.
 * @param {string} domainString - z.B. 'Encounter, NPCs' oder 'Travel'
 * @returns {string[]}
 */
export function parseDomain(domainString) {
  return parseMultiValue(domainString);
}

/**
 * Parst Layer-String zu Array.
 * @param {string} layerString - z.B. 'services, features' oder 'services/encounter'
 * @returns {string[]}
 */
export function parseLayer(layerString) {
  return parseMultiValue(layerString);
}

/**
 * @typedef {Object} Bug
 * @property {string} id
 * @property {string} status
 * @property {string} beschreibung
 * @property {string} prio
 * @property {string[]} deps
 * @property {number} lineNumber
 */
