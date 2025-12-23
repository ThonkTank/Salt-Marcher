/**
 * Unified Table Parser
 *
 * Einheitlicher Parser für alle Tabellen-Formate (Roadmap Tasks, Bugs, Doc Tables).
 * Ersetzt die duplizierten Parsing-Funktionen in task-utils.mjs.
 */

import { ok, err, TaskErrorCode } from '../result.mjs';
import {
  RoadmapTaskSchema,
  BugTableSchema,
  DocTableSchemaOld,
  DocTableSchemaNew,
  TaskStatus
} from './schema.mjs';

// ============================================================================
// LOW-LEVEL PARSING
// ============================================================================

/**
 * Splittet eine Tabellen-Zeile in Zellen
 * Robuster als einfaches split('|') - behandelt leere Zellen korrekt
 *
 * @param {string} line - Die Tabellen-Zeile
 * @returns {string[]} - Array von getrimmten Zellen (ohne führende/trailing leere Elemente)
 */
export function splitTableLine(line) {
  if (!line.startsWith('|')) return [];

  // Split und trim
  const parts = line.split('|');

  // Erste und letzte leere Elemente entfernen (von | am Anfang/Ende)
  const cells = parts.slice(1, -1).map(c => c.trim());

  return cells;
}

/**
 * Prüft ob eine Zeile eine Separator-Zeile ist (z.B. |---|---|---|)
 * @param {string} line - Die Zeile
 * @returns {boolean}
 */
export function isSeparatorLine(line) {
  return /^\|[\s:|-]+\|$/.test(line);
}

/**
 * Prüft ob eine Zeile eine Header-Zeile ist
 * @param {string} line - Die Zeile
 * @param {RegExp} pattern - Das Header-Pattern aus dem Schema
 * @returns {boolean}
 */
export function isHeaderLine(line, pattern) {
  return pattern.test(line);
}

// ============================================================================
// ID PARSING
// ============================================================================

/**
 * Parst eine Task-ID (z.B. "428", "428b", "2917a", "b4")
 *
 * @param {string|number} raw - Rohe ID
 * @returns {string|number|null} - Geparste ID oder null
 */
export function parseTaskId(raw) {
  const trimmed = String(raw).trim();

  // Bug-ID (z.B. "b4")
  if (/^b\d+$/.test(trimmed)) return trimmed;

  // Alphanumerische ID (z.B. "428b", "2917a")
  if (/^\d+[a-z]$/i.test(trimmed)) return trimmed.toLowerCase();

  // Reine Zahl
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parst Dependencies aus einem String
 * Unterstützt: #123, #428b, b4
 *
 * @param {string} depsRaw - Roher Deps-String
 * @returns {Array<string|number>} - Array von geparsten IDs
 */
export function parseDeps(depsRaw) {
  if (!depsRaw || depsRaw === '-') return [];

  const deps = [];
  // Match: #123, #428b, #2917a, b4
  const matches = depsRaw.matchAll(/#(\d+[a-z]?)|b(\d+)/gi);

  for (const match of matches) {
    if (match[1]) {
      // Task-ID: kann Zahl oder alphanumerisch sein
      deps.push(parseTaskId(match[1]));
    } else if (match[2]) {
      // Bug-ID: z.B. "b4"
      deps.push(`b${match[2]}`);
    }
  }

  return deps.filter(d => d !== null);
}

/**
 * Formatiert eine Task-/Bug-ID für Ausgabe
 * @param {string|number} id - ID
 * @returns {string} - Formatierte ID
 */
export function formatId(id) {
  if (typeof id === 'number') return `#${id}`;
  if (typeof id === 'string' && id.startsWith('b')) return id;
  return `#${id}`;
}

/**
 * Formatiert Dependencies für Ausgabe in Tabelle
 * @param {Array<string|number>} deps - Array von IDs
 * @returns {string} - Formatierter String (z.B. "#100, #202, b4")
 */
export function formatDeps(deps) {
  if (!deps || deps.length === 0) return '-';
  return deps.map(d => formatId(d)).join(', ');
}

/**
 * Prüft ob eine ID eine Task-ID ist (vs Bug-ID)
 * @param {string|number} id - ID
 * @returns {boolean}
 */
export function isTaskId(id) {
  if (typeof id === 'number') return true;
  if (typeof id === 'string' && !id.startsWith('b')) return true;
  return false;
}

/**
 * Prüft ob eine ID eine Bug-ID ist
 * @param {string|number} id - ID
 * @returns {boolean}
 */
export function isBugId(id) {
  return typeof id === 'string' && id.startsWith('b');
}

/**
 * Extrahiert Task-IDs aus einem Test-Namen (für test-reporter)
 * Unterstützt: "#428", "[#428, #429]", "#428, #429"
 *
 * @param {string} name - Test-Name
 * @returns {number[]} - Array von Task-IDs (nur Zahlen)
 */
export function extractTaskIds(name) {
  const ids = [];
  const matches = name.match(/#(\d+)/g);
  if (matches) {
    for (const match of matches) {
      ids.push(parseInt(match.slice(1), 10));
    }
  }
  return [...new Set(ids)]; // Duplikate entfernen
}

// ============================================================================
// ROW PARSING
// ============================================================================

/**
 * Parst eine einzelne Zeile basierend auf einem Schema
 *
 * @param {string} line - Die Tabellen-Zeile
 * @param {object} schema - Das Schema (RoadmapTaskSchema, BugTableSchema, etc.)
 * @param {number} lineIndex - Zeilen-Index in der Datei
 * @returns {object} - Result<ParsedRow, ParseError>
 */
export function parseRow(line, schema, lineIndex = -1) {
  const cells = splitTableLine(line);

  if (cells.length < schema.minColumns) {
    return err({
      code: TaskErrorCode.INSUFFICIENT_COLUMNS,
      message: `Zeile hat ${cells.length} Spalten, erwartet mindestens ${schema.minColumns}`,
      lineIndex,
      line
    });
  }

  const item = {};

  // Werte aus Schema-Indices extrahieren
  for (const [name, index] of Object.entries(schema.indices)) {
    const value = cells[index]?.trim() ?? '';
    item[name] = value;
  }

  // ID parsen
  const parsedId = parseTaskId(item.number);
  if (parsedId === null) {
    return err({
      code: TaskErrorCode.INVALID_ID,
      message: `Ungültige ID: ${item.number}`,
      lineIndex,
      line
    });
  }
  item.number = parsedId;

  // Dependencies parsen
  if (item.deps !== undefined) {
    item.depsRaw = item.deps;
    item.deps = parseDeps(item.depsRaw);
  }

  // Metadaten hinzufügen
  if (lineIndex >= 0) {
    item.lineIndex = lineIndex;
  }
  item.originalLine = line;

  return ok(item);
}

/**
 * Parst eine Roadmap-Task-Zeile
 * @param {string} line - Die Zeile
 * @param {number} [lineIndex] - Optional Zeilen-Index
 * @returns {object} - Result<Task, ParseError>
 */
export function parseTaskLine(line, lineIndex = -1) {
  const result = parseRow(line, RoadmapTaskSchema, lineIndex);

  if (!result.ok) return result;

  // Bug-IDs in Task-Tabelle ablehnen
  if (isBugId(result.value.number)) {
    return err({
      code: TaskErrorCode.INVALID_ID,
      message: 'Bug-ID in Task-Tabelle gefunden',
      lineIndex,
      line
    });
  }

  result.value.isBug = false;
  return result;
}

/**
 * Parst eine Bug-Zeile
 * @param {string} line - Die Zeile
 * @param {number} [lineIndex] - Optional Zeilen-Index
 * @returns {object} - Result<Bug, ParseError>
 */
export function parseBugLine(line, lineIndex = -1) {
  const result = parseRow(line, BugTableSchema, lineIndex);

  if (!result.ok) return result;

  // Nur Bug-IDs erlauben
  if (!isBugId(result.value.number)) {
    return err({
      code: TaskErrorCode.INVALID_ID,
      message: 'Task-ID in Bug-Tabelle gefunden',
      lineIndex,
      line
    });
  }

  // Bug-spezifische Defaults
  result.value.isBug = true;
  result.value.bereich = 'Bug';
  result.value.mvp = 'Ja';
  result.value.spec = '-';
  result.value.imp = '-';

  return result;
}

// ============================================================================
// TABLE PARSING
// ============================================================================

/**
 * Parst eine komplette Tabelle aus Content
 *
 * @param {string} content - Der Dateiinhalt
 * @param {object} schema - Das Schema
 * @param {object} [options] - Optionen
 * @param {boolean} [options.includeLineIndex=true] - lineIndex hinzufügen
 * @param {boolean} [options.includeOriginalLine=true] - originalLine hinzufügen
 * @returns {object} - Result<{ items: Array, lines: string[] }, ParseError>
 */
export function parseTable(content, schema, options = {}) {
  const {
    includeLineIndex = true,
    includeOriginalLine = true
  } = options;

  const lines = content.split('\n');
  const items = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Header erkennen
    if (isHeaderLine(line, schema.headerPattern)) {
      inTable = true;
      continue;
    }

    // In Tabelle
    if (inTable) {
      // Separator überspringen
      if (isSeparatorLine(line)) continue;

      // Tabelle beenden wenn keine Pipe mehr
      if (!line.startsWith('|')) {
        inTable = false;
        continue;
      }

      // Zeile parsen
      const parseResult = parseRow(line, schema, includeLineIndex ? i : -1);

      if (parseResult.ok) {
        const item = parseResult.value;
        if (!includeOriginalLine) {
          delete item.originalLine;
        }
        items.push(item);
      }
      // Fehlerhafte Zeilen werden übersprungen (kein Abbruch)
    }
  }

  return ok({ items, lines });
}

// ============================================================================
// ROADMAP PARSING (HIGH-LEVEL)
// ============================================================================

/**
 * Parst die gesamte Roadmap-Datei (Tasks + Bugs)
 *
 * @param {string} content - Dateiinhalt
 * @param {object} [options] - Optionen
 * @param {boolean} [options.separateBugs=false] - true: { tasks, bugs }, false: { items }
 * @param {boolean} [options.includeLineIndex=true] - lineIndex hinzufügen
 * @param {boolean} [options.includeOriginalLine=true] - originalLine hinzufügen
 * @param {boolean} [options.returnLines=true] - lines Array zurückgeben
 * @param {boolean} [options.returnItemMap=true] - itemMap (Map) zurückgeben
 * @returns {object} - Result<RoadmapData, ParseError>
 */
export function parseRoadmap(content, options = {}) {
  const {
    separateBugs = false,
    includeLineIndex = true,
    includeOriginalLine = true,
    returnLines = true,
    returnItemMap = true
  } = options;

  const lines = content.split('\n');
  const tasks = [];
  const bugs = [];

  let inTaskTable = false;
  let inBugTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Task-Tabelle erkennen
    if (isHeaderLine(line, RoadmapTaskSchema.headerPattern)) {
      inTaskTable = true;
      inBugTable = false;
      continue;
    }

    // Bug-Tabelle erkennen
    if (isHeaderLine(line, BugTableSchema.headerPattern)) {
      inBugTable = true;
      inTaskTable = false;
      continue;
    }

    // Separator überspringen
    if ((inTaskTable || inBugTable) && isSeparatorLine(line)) {
      continue;
    }

    // Tabelle beenden
    if ((inTaskTable || inBugTable) && !line.startsWith('|')) {
      if (line.trim() === '' || line.startsWith('#')) {
        inTaskTable = false;
        inBugTable = false;
      }
      continue;
    }

    // Zeilen parsen
    if (inTaskTable) {
      const result = parseTaskLine(line, includeLineIndex ? i : -1);
      if (result.ok) {
        const task = result.value;
        if (!includeOriginalLine) delete task.originalLine;
        tasks.push(task);
      }
    }

    if (inBugTable) {
      const result = parseBugLine(line, includeLineIndex ? i : -1);
      if (result.ok) {
        const bug = result.value;
        if (!includeOriginalLine) delete bug.originalLine;
        bugs.push(bug);
      }
    }
  }

  // Ergebnis zusammenstellen
  const result = {};

  if (separateBugs) {
    result.tasks = tasks;
    result.bugs = bugs;
  } else {
    result.items = [...tasks, ...bugs];
  }

  if (returnLines) {
    result.lines = lines;
  }

  if (returnItemMap) {
    const allItems = [...tasks, ...bugs];
    result.itemMap = new Map(allItems.map(item => [item.number, item]));
  }

  return ok(result);
}

// ============================================================================
// DOC TABLE PARSING
// ============================================================================

/**
 * Erkennt das Format einer Doc-Tasks-Tabelle
 *
 * @param {string} headerLine - Header-Zeile der Tabelle
 * @returns {object} - Format-Info
 */
export function detectDocTableFormat(headerLine) {
  const cells = splitTableLine(headerLine);
  const normalizedCells = cells.map(c => c.toLowerCase());

  return {
    columns: cells,
    columnCount: cells.length,
    hasStatus: normalizedCells.includes('status'),
    hasBereich: normalizedCells.includes('bereich'),
    hasImp: normalizedCells.some(c => c.includes('imp')),
    hasReferenzen: normalizedCells.some(c => c.includes('referenz')),
    hasSpec: normalizedCells.includes('spec'),
    // Alte 6-Spalten: # | Beschreibung | Prio | MVP? | Deps | Spec
    isOldFormat: cells.length === 6 && !normalizedCells.includes('status'),
    // Neue 9-Spalten: # | Status | Bereich | Beschreibung | Prio | MVP? | Deps | Spec | Imp.
    isNewFormat: cells.length >= 9 && normalizedCells.includes('status')
  };
}

/**
 * Parst eine Task-Zeile aus einer Doc-Tasks-Tabelle (format-agnostisch)
 *
 * @param {string} line - Die Task-Zeile
 * @param {object} [format] - Format-Info von detectDocTableFormat()
 * @returns {object|null} - Geparstes Task-Objekt oder null
 */
export function parseDocTaskLine(line, format = null) {
  const cells = splitTableLine(line);
  if (cells.length < 6) return null;

  // Erste Zelle sollte eine Nummer sein
  const numberStr = cells[0];
  const parsedId = parseTaskId(numberStr);
  if (parsedId === null) return null;

  // Format automatisch erkennen
  const isNewFormat = format?.isNewFormat ?? (cells.length >= 9);

  if (isNewFormat && cells.length >= 9) {
    // Neues 9-Spalten-Format
    return {
      number: numberStr,
      status: cells[1],
      bereich: cells[2],
      beschreibung: cells[3],
      prio: cells[4],
      mvp: cells[5],
      depsRaw: cells[6],
      deps: parseDeps(cells[6]).map(d => String(d)),
      spec: cells[7],
      imp: cells[8]
    };
  } else {
    // Altes 6-Spalten-Format
    return {
      number: numberStr,
      status: null,
      bereich: null,
      beschreibung: cells[1],
      prio: cells[2],
      mvp: cells[3],
      depsRaw: cells[4],
      deps: parseDeps(cells[4]).map(d => String(d)),
      spec: cells[5],
      imp: null
    };
  }
}
