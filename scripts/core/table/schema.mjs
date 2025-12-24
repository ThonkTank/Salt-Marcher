/**
 * Table Schema Definitions
 *
 * Zentrale Definitionen für alle Tabellen-Formate in der Roadmap und Docs.
 * Single Source of Truth für Spalten, Indices und Status-Symbole.
 */

// ============================================================================
// STATUS DEFINITIONS
// ============================================================================

/**
 * Task-Status Symbole
 * @readonly
 */
export const TaskStatus = Object.freeze({
  OPEN: '⬜',
  READY: '🟢',        // Vorbereitet, bereit zur Umsetzung
  DONE: '✅',
  PARTIAL: '🔶',      // Implementiert, aber nicht spezifikationskonform
  BROKEN: '⚠️',       // Implementiert, aber funktioniert nicht
  CLAIMED: '🔒',      // Von einem Agenten in Bearbeitung
  BLOCKED: '⛔',      // Dependencies nicht erfüllt
  REVIEW: '📋'        // Pending Review
});

/**
 * Alle gültigen Status-Werte (für Validierung)
 */
export const VALID_STATUSES = Object.freeze([
  TaskStatus.OPEN,
  TaskStatus.READY,
  TaskStatus.DONE,
  TaskStatus.PARTIAL,
  TaskStatus.BROKEN,
  TaskStatus.CLAIMED,
  TaskStatus.BLOCKED,
  TaskStatus.REVIEW
]);

/**
 * Status-Aliase für CLI-Input
 * Erlaubt lesbare Namen statt Emojis
 */
export const STATUS_ALIASES = Object.freeze({
  // English
  'done': TaskStatus.DONE,
  'complete': TaskStatus.DONE,
  'ready': TaskStatus.READY,
  'prepared': TaskStatus.READY,
  'partial': TaskStatus.PARTIAL,
  'nonconform': TaskStatus.PARTIAL,
  'broken': TaskStatus.BROKEN,
  'warning': TaskStatus.BROKEN,
  'open': TaskStatus.OPEN,
  'todo': TaskStatus.OPEN,
  'claimed': TaskStatus.CLAIMED,
  'locked': TaskStatus.CLAIMED,
  'wip': TaskStatus.CLAIMED,
  'blocked': TaskStatus.BLOCKED,
  'review': TaskStatus.REVIEW,
  'pending': TaskStatus.REVIEW,
  'approval': TaskStatus.REVIEW,
  // German
  'fertig': TaskStatus.DONE,
  'bereit': TaskStatus.READY,
  'offen': TaskStatus.OPEN,
  'blockiert': TaskStatus.BLOCKED
});

/**
 * Status-Priorität für Sortierung
 * Niedrigere Zahl = höhere Priorität (wird zuerst angezeigt)
 */
export const STATUS_PRIORITY = Object.freeze({
  [TaskStatus.REVIEW]: 0,   // Review-Tasks ganz oben
  [TaskStatus.READY]: 1,    // Bereit zur Umsetzung
  [TaskStatus.PARTIAL]: 2,  // Nicht-konforme Tasks
  [TaskStatus.BROKEN]: 3,   // Kaputte Tasks
  [TaskStatus.OPEN]: 4,     // Offene Tasks
  [TaskStatus.CLAIMED]: 5,  // In Arbeit
  [TaskStatus.DONE]: 6,     // Fertig
  [TaskStatus.BLOCKED]: 7   // Blockiert ganz unten
});

// ============================================================================
// PRIORITY DEFINITIONS
// ============================================================================

/**
 * Prioritäts-Werte
 */
export const Priority = Object.freeze({
  HIGH: 'hoch',
  MEDIUM: 'mittel',
  LOW: 'niedrig'
});

/**
 * Prioritäts-Sortierung (niedrigere Zahl = höhere Priorität)
 */
export const PRIO_PRIORITY = Object.freeze({
  [Priority.HIGH]: 0,
  [Priority.MEDIUM]: 1,
  [Priority.LOW]: 2
});

/**
 * MVP-Sortierung (niedrigere Zahl = höhere Priorität)
 */
export const MVP_PRIORITY = Object.freeze({
  'Ja': 0,
  'Nein': 1
});

// ============================================================================
// ROADMAP TABLE SCHEMA
// ============================================================================

/**
 * Spalten-Namen für die Roadmap Task-Tabelle
 */
export const RoadmapTaskColumns = Object.freeze([
  'number',
  'status',
  'domain',
  'layer',
  'beschreibung',
  'prio',
  'mvp',
  'deps',
  'spec',
  'imp'
]);

/**
 * Spalten-Indices für die Roadmap Task-Tabelle
 * Mapping von Spaltenname zu Array-Index (nach split('|').filter(Boolean))
 */
export const RoadmapTaskIndices = Object.freeze({
  number: 0,
  status: 1,
  domain: 2,
  layer: 3,
  beschreibung: 4,
  prio: 5,
  mvp: 6,
  deps: 7,
  spec: 8,
  imp: 9
});

/**
 * Roadmap Task-Tabellen Schema
 */
export const RoadmapTaskSchema = Object.freeze({
  columns: RoadmapTaskColumns,
  indices: RoadmapTaskIndices,
  minColumns: 10,
  headerPattern: /\|\s*#\s*\|\s*Status\s*\|/i,
  headerText: '| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |',
  separatorText: '|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|'
});

// ============================================================================
// BUG TABLE SCHEMA
// ============================================================================

/**
 * Spalten-Namen für die Bug-Tabelle
 */
export const BugTableColumns = Object.freeze([
  'number',
  'status',
  'beschreibung',
  'prio',
  'deps'
]);

/**
 * Spalten-Indices für die Bug-Tabelle
 */
export const BugTableIndices = Object.freeze({
  number: 0,
  status: 1,
  beschreibung: 2,
  prio: 3,
  deps: 4
});

/**
 * Bug-Tabellen Schema
 */
export const BugTableSchema = Object.freeze({
  columns: BugTableColumns,
  indices: BugTableIndices,
  minColumns: 5,
  headerPattern: /\|\s*b#\s*\|/i,
  headerText: '| b# | Status | Beschreibung | Prio | Deps |',
  separatorText: '|:---|:------:|--------------|:----:|------|'
});

// ============================================================================
// DOC TABLE SCHEMAS
// ============================================================================

/**
 * Altes 6-Spalten Doc-Format
 * Format: | # | Beschreibung | Prio | MVP? | Deps | Referenzen |
 */
export const DocTableSchemaOld = Object.freeze({
  columns: ['number', 'beschreibung', 'prio', 'mvp', 'deps', 'referenzen'],
  indices: {
    number: 0,
    beschreibung: 1,
    prio: 2,
    mvp: 3,
    deps: 4,
    referenzen: 5
  },
  minColumns: 6
});

/**
 * Neues 10-Spalten Doc-Format (identisch mit Roadmap)
 * Format: | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
 */
export const DocTableSchemaNew = Object.freeze({
  columns: ['number', 'status', 'domain', 'layer', 'beschreibung', 'prio', 'mvp', 'deps', 'spec', 'imp'],
  indices: {
    number: 0,
    status: 1,
    domain: 2,
    layer: 3,
    beschreibung: 4,
    prio: 5,
    mvp: 6,
    deps: 7,
    spec: 8,
    imp: 9
  },
  minColumns: 10,
  headerText: '| # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |',
  separatorText: '|--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|'
});

// ============================================================================
// CLAIM CONSTANTS
// ============================================================================

/**
 * Claim-Ablaufzeit in Millisekunden (2 Stunden)
 */
export const CLAIM_EXPIRY_MS = 2 * 60 * 60 * 1000;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Löst einen Status-Alias auf oder gibt den Input zurück wenn kein Alias
 * @param {string} statusOrAlias - Status-Emoji oder Alias
 * @returns {string} - Status-Emoji
 */
export function resolveStatusAlias(statusOrAlias) {
  if (!statusOrAlias) return statusOrAlias;
  const trimmed = statusOrAlias.trim().toLowerCase();
  return STATUS_ALIASES[trimmed] ?? statusOrAlias;
}

/**
 * Prüft ob ein Status gültig ist
 * @param {string} status - Status zu prüfen
 * @returns {boolean}
 */
export function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

/**
 * Gibt den Status-Namen (ohne Emoji) zurück
 * @param {string} status - Status-Emoji
 * @returns {string} - Lesbarer Name
 */
export function getStatusName(status) {
  const names = {
    [TaskStatus.OPEN]: 'Offen',
    [TaskStatus.READY]: 'Bereit',
    [TaskStatus.DONE]: 'Fertig',
    [TaskStatus.PARTIAL]: 'Nicht-konform',
    [TaskStatus.BROKEN]: 'Defekt',
    [TaskStatus.CLAIMED]: 'In Bearbeitung',
    [TaskStatus.BLOCKED]: 'Blockiert',
    [TaskStatus.REVIEW]: 'Review'
  };
  return names[status] ?? 'Unbekannt';
}
