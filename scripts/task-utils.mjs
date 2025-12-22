#!/usr/bin/env node
/**
 * Task-Utilities - Gemeinsame Funktionen für alle Task-Skripte
 *
 * Dieses Modul konsolidiert duplizierte Funktionen aus:
 * - prioritize-tasks.mjs
 * - task-lookup.mjs
 * - update-tasks.mjs
 * - sync-roadmap-tasks.mjs
 * - test-reporter.mjs
 * - extract-tasks-by-spec.mjs
 * - add-tasks-sections.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================================================
// PFAD-KONSTANTEN
// ============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROADMAP_PATH = join(__dirname, '..', 'docs', 'architecture', 'Development-Roadmap.md');
export const DOCS_PATH = join(__dirname, '..', 'docs');
export const CLAIMS_PATH = join(__dirname, '..', 'docs', 'architecture', '.task-claims.json');
export const CLAIM_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 Stunden

// ============================================================================
// ID-UTILITIES
// ============================================================================

/**
 * Parst eine Task-ID (z.B. "428", "428b", "2917a", "b4")
 * Gibt String zurück für alphanumerische IDs und Bug-IDs, Zahl für reine Ziffern
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
 * - Zahlen: #428
 * - Alphanumerische Task-IDs: #428b
 * - Bug-IDs: b4 (ohne #)
 *
 * @param {string|number} id - ID
 * @returns {string} - Formatierte ID
 */
export function formatId(id) {
  if (typeof id === 'number') return `#${id}`;
  if (typeof id === 'string' && id.startsWith('b')) return id;  // Bug-ID
  return `#${id}`;  // Alphanumerische Task-ID
}

/**
 * Formatiert Dependencies für Ausgabe in Tabelle
 *
 * @param {Array<string|number>} deps - Array von IDs
 * @returns {string} - Formatierter String (z.B. "#100, #202, b4")
 */
export function formatDeps(deps) {
  if (!deps || deps.length === 0) return '-';
  return deps.map(d => formatId(d)).join(', ');
}

/**
 * Prüft ob eine ID eine Task-ID ist (Zahl oder alphanumerisch wie "428b")
 * im Gegensatz zu einer Bug-ID (String wie "b4")
 *
 * @param {string|number} id - ID
 * @returns {boolean}
 */
export function isTaskId(id) {
  if (typeof id === 'number') return true;
  if (typeof id === 'string' && !id.startsWith('b')) return true;
  return false;
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
  const singleMatches = name.match(/#(\d+)/g);
  if (singleMatches) {
    for (const match of singleMatches) {
      ids.push(parseInt(match.slice(1), 10));
    }
  }
  return [...new Set(ids)]; // Duplikate entfernen
}

// ============================================================================
// CLAIMS-MANAGEMENT
// ============================================================================

/**
 * Holt Agent-ID mit Fallback-Kette:
 * 1. Umgebungsvariable CLAUDE_AGENT_ID (höchste Priorität)
 * 2. CLI-Flag
 * 3. null (keine ID verfügbar)
 *
 * @param {string|null} cliAgentId - Optional CLI-Flag Wert
 * @returns {string|null}
 */
export function getAgentId(cliAgentId = null) {
  // 1. Umgebungsvariable (höchste Priorität)
  if (process.env.CLAUDE_AGENT_ID) {
    return process.env.CLAUDE_AGENT_ID;
  }

  // 2. CLI-Flag
  if (cliAgentId) {
    return cliAgentId;
  }

  // 3. Keine ID verfügbar
  return null;
}

/**
 * Lädt Claims aus der JSON-Datei
 *
 * @returns {Object} - Claims-Objekt { taskId: { owner, timestamp } }
 */
export function loadClaims() {
  try {
    if (!existsSync(CLAIMS_PATH)) return {};
    const content = readFileSync(CLAIMS_PATH, 'utf-8');
    const data = JSON.parse(content);
    return data.claims || {};
  } catch {
    return {};
  }
}

/**
 * Speichert Claims in die JSON-Datei
 *
 * @param {Object} claims - Claims-Objekt
 */
export function saveClaims(claims) {
  writeFileSync(CLAIMS_PATH, JSON.stringify({ claims }, null, 2));
}

/**
 * Prüft und entfernt abgelaufene Claims (>2h)
 *
 * @param {Object} claims - Claims-Objekt (wird mutiert)
 * @returns {Array} - Liste der abgelaufenen Claims
 */
export function checkClaimExpiry(claims) {
  const now = Date.now();
  const expired = [];

  for (const [taskId, claim] of Object.entries(claims)) {
    const claimTime = new Date(claim.timestamp).getTime();
    if (now - claimTime > CLAIM_EXPIRY_MS) {
      expired.push({ taskId, owner: claim.owner });
      delete claims[taskId];
    }
  }

  return expired;
}

/**
 * Formatiert verbleibende Zeit bis Claim-Ablauf
 *
 * @param {string} timestamp - ISO-Timestamp
 * @returns {string} - z.B. "1h 30m" oder "abgelaufen"
 */
export function formatTimeRemaining(timestamp) {
  const claimTime = new Date(timestamp).getTime();
  const expiresAt = claimTime + CLAIM_EXPIRY_MS;
  const remaining = expiresAt - Date.now();

  if (remaining <= 0) return 'abgelaufen';

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================================
// ROADMAP-PARSING
// ============================================================================

/**
 * Parst eine Task-Zeile aus der Markdown-Tabelle
 *
 * @param {string} line - Tabellenzeile
 * @param {Object} options - Optionen
 * @param {number} options.minColumns - Mindestanzahl Spalten (default: 7)
 * @returns {Object|null} - Geparste Task oder null
 */
export function parseTaskLine(line, options = {}) {
  const { minColumns = 7 } = options;

  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < minColumns) return null;

  const number = parseTaskId(cells[0]);
  if (number === null) return null;
  // Bug-IDs werden in parseBugLine behandelt
  if (typeof number === 'string' && number.startsWith('b')) return null;

  const task = {
    number,
    status: cells[1],
    bereich: cells[2],
    beschreibung: cells[3],
    prio: cells[4],
    mvp: cells[5],
    depsRaw: cells[6],
    deps: parseDeps(cells[6]),
    isBug: false
  };

  // Optionale zusätzliche Spalten (für 9-Spalten-Format)
  if (cells.length >= 8) task.spec = cells[7];
  if (cells.length >= 9) task.imp = cells[8];

  return task;
}

/**
 * Parst eine Bug-Zeile aus der Markdown-Tabelle
 * Format: | b# | Status | Beschreibung | Prio | Deps |
 *
 * @param {string} line - Tabellenzeile
 * @returns {Object|null} - Geparster Bug oder null
 */
export function parseBugLine(line) {
  const cells = line.split('|').map(c => c.trim()).filter(Boolean);
  if (cells.length < 5) return null;

  const match = cells[0].match(/^b(\d+)$/);
  if (!match) return null;

  return {
    number: cells[0],  // z.B. "b1"
    status: cells[1],
    bereich: 'Bug',
    beschreibung: cells[2],
    prio: cells[3],
    mvp: 'Ja',         // Bugs sind immer MVP-relevant
    depsRaw: cells[4],
    deps: parseDeps(cells[4]),
    spec: '-',
    imp: '-',
    isBug: true
  };
}

/**
 * Parst die gesamte Roadmap-Datei
 *
 * @param {string} content - Dateiinhalt
 * @param {Object} options - Optionen
 * @param {boolean} options.separateBugs - true: { tasks, bugs }, false: flache Liste (default: false)
 * @param {boolean} options.includeLineIndex - lineIndex pro Item hinzufügen (default: false)
 * @param {boolean} options.includeOriginalLine - originalLine pro Item hinzufügen (default: false)
 * @param {boolean} options.returnLines - lines-Array zurückgeben (default: false)
 * @param {boolean} options.returnItemMap - itemMap zurückgeben (default: false)
 * @param {number} options.minColumns - Mindestanzahl Spalten für Tasks (default: 7)
 * @returns {Object|Array} - Je nach Optionen verschiedene Strukturen
 */
export function parseRoadmap(content, options = {}) {
  const {
    separateBugs = false,
    includeLineIndex = false,
    includeOriginalLine = false,
    returnLines = false,
    returnItemMap = false,
    minColumns = 7
  } = options;

  const lines = content.split('\n');
  const tasks = [];
  const bugs = [];
  let inTaskTable = false;
  let inBugTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Task-Tabelle erkennen
    if (line.includes('| # | Status |')) {
      inTaskTable = true;
      inBugTable = false;
      continue;
    }
    // Bug-Tabelle erkennen
    if (line.includes('| b# |')) {
      inBugTable = true;
      inTaskTable = false;
      continue;
    }
    // Separator-Zeile überspringen
    if ((inTaskTable || inBugTable) && line.match(/^\|[\s:-]+\|/)) continue;
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
      const task = parseTaskLine(line, { minColumns });
      if (task) {
        if (includeLineIndex) task.lineIndex = i;
        if (includeOriginalLine) task.originalLine = line;
        tasks.push(task);
      }
    }
    if (inBugTable) {
      const bug = parseBugLine(line);
      if (bug) {
        if (includeLineIndex) bug.lineIndex = i;
        if (includeOriginalLine) bug.originalLine = line;
        bugs.push(bug);
      }
    }
  }

  // Rückgabe-Format basierend auf Optionen
  if (separateBugs || returnLines || returnItemMap) {
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
      result.itemMap = new Map(allItems.map(t => [t.number, t]));
    }

    return result;
  }

  // Default: Flache Liste aller Items
  return [...tasks, ...bugs];
}

// ============================================================================
// FILE-UTILITIES
// ============================================================================

/**
 * Findet alle Markdown-Dateien rekursiv in einem Verzeichnis
 *
 * @param {string} dir - Verzeichnispfad
 * @param {string[]} files - Akkumulator (intern)
 * @returns {string[]} - Array von Dateipfaden
 */
export function findMarkdownFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findMarkdownFiles(fullPath, files);
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ============================================================================
// ROADMAP-UPDATE (für test-reporter)
// ============================================================================

/**
 * Aktualisiert den Status einer Task in der Roadmap
 *
 * @param {number} taskId - Task-ID
 * @param {string} newStatus - Neuer Status
 * @param {string} errorMessage - Optional: Fehlermeldung
 * @returns {boolean} - true wenn aktualisiert
 */
export function updateTaskStatusInRoadmap(taskId, newStatus, errorMessage) {
  const content = readFileSync(ROADMAP_PATH, 'utf-8');
  const lines = content.split('\n');
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Task-Zeile finden: | 428 | ✅ | ...
    const match = line.match(/^\|\s*(\d+)\s*\|\s*([⬜✅🔶⚠️🔒])\s*\|/);
    if (match && parseInt(match[1], 10) === taskId) {
      const oldStatus = match[2];

      // Nur updaten wenn nicht bereits der Zielstatus
      if (oldStatus !== newStatus) {
        // Status ersetzen
        lines[i] = line.replace(
          /^\|(\s*\d+\s*)\|(\s*)[⬜✅🔶⚠️🔒](\s*)\|/,
          `|$1|$2${newStatus}$3|`
        );

        // Fehler in Beschreibung einfügen (wenn nicht bereits vorhanden)
        if (errorMessage && !lines[i].includes('[TEST FAILED]')) {
          const cells = lines[i].split('|');
          if (cells.length > 3) {
            const desc = cells[3].trim();
            cells[3] = ` [TEST FAILED] ${desc} `;
            lines[i] = cells.join('|');
          }
        }
        updated = true;
      }
      break;
    }
  }

  if (updated) {
    writeFileSync(ROADMAP_PATH, lines.join('\n'));
  }
  return updated;
}

// ============================================================================
// PRIORITÄTS-KONSTANTEN (für prioritize-tasks)
// ============================================================================

export const STATUS_PRIORITY = { '🔶': 0, '⚠️': 1, '⬜': 2, '🔒': 3, '✅': 4 };
export const MVP_PRIORITY = { 'Ja': 0, 'Nein': 1 };
export const PRIO_PRIORITY = { 'hoch': 0, 'mittel': 1, 'niedrig': 2 };

// Status-Aliase für CLI
export const STATUS_ALIASES = {
  'done': '✅', 'fertig': '✅', 'complete': '✅',
  'partial': '🔶', 'nonconform': '🔶',
  'broken': '⚠️', 'warning': '⚠️',
  'open': '⬜', 'todo': '⬜', 'offen': '⬜',
  'claimed': '🔒', 'locked': '🔒', 'wip': '🔒'
};

export const VALID_STATUSES = ['⬜', '✅', '⚠️', '🔶', '🔒'];
