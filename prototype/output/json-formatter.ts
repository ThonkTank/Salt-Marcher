/**
 * JSON Formatter
 *
 * Formatiert Pipeline-Outputs als indented JSON.
 */

import type {
  EncounterContext,
  EncounterDraft,
  FlavouredEncounter,
  DifficultyResult,
  BalancedEncounter,
  PipelineState,
} from '../types/encounter.js';

// =============================================================================
// Generic
// =============================================================================

/**
 * Formatiert beliebige Daten als indented JSON.
 */
export function formatJson(data: unknown, indent = 2): string {
  return JSON.stringify(data, null, indent);
}

// =============================================================================
// Pipeline-specific formatters
// =============================================================================

/**
 * Formatiert einen EncounterContext als JSON.
 */
export function formatContextJson(context: EncounterContext): string {
  return formatJson(context);
}

/**
 * Formatiert einen EncounterDraft als JSON.
 */
export function formatDraftJson(draft: EncounterDraft): string {
  return formatJson(draft);
}

/**
 * Formatiert ein FlavouredEncounter als JSON.
 */
export function formatFlavouredJson(flavoured: FlavouredEncounter): string {
  return formatJson(flavoured);
}

/**
 * Formatiert ein DifficultyResult als JSON.
 */
export function formatDifficultyJson(difficulty: DifficultyResult): string {
  return formatJson(difficulty);
}

/**
 * Formatiert ein BalancedEncounter als JSON.
 */
export function formatBalancedJson(balanced: BalancedEncounter): string {
  return formatJson(balanced);
}

/**
 * Formatiert den gesamten PipelineState als JSON.
 */
export function formatStateJson(state: PipelineState): string {
  return formatJson(state);
}
