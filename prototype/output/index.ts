/**
 * Output Formatters
 *
 * Provides JSON and Text formatting for pipeline outputs.
 *
 * Usage:
 *   import { createFormatter } from './output/index.js';
 *   const formatter = createFormatter('text');
 *   console.log(formatter.formatState(state));
 */

import type {
  EncounterContext,
  EncounterDraft,
  FlavouredEncounter,
  DifficultyResult,
  BalancedEncounter,
  PipelineState,
  OutputMode,
} from '../types/encounter.js';

// Re-export JSON formatters
export {
  formatJson,
  formatContextJson,
  formatDraftJson,
  formatFlavouredJson,
  formatDifficultyJson,
  formatBalancedJson,
  formatStateJson,
} from './json-formatter.js';

// Re-export Text formatters
export {
  formatContextText,
  formatDraftText,
  formatFlavouredText,
  formatDifficultyText,
  formatBalancedText,
  formatStateText,
} from './text-formatter.js';

// Import for factory
import * as jsonFormatter from './json-formatter.js';
import * as textFormatter from './text-formatter.js';

// =============================================================================
// Formatter Interface
// =============================================================================

/**
 * Unified formatter interface for pipeline outputs.
 */
export interface Formatter {
  readonly mode: OutputMode;
  formatContext(context: EncounterContext): string;
  formatDraft(draft: EncounterDraft): string;
  formatFlavoured(flavoured: FlavouredEncounter): string;
  formatDifficulty(difficulty: DifficultyResult): string;
  formatBalanced(balanced: BalancedEncounter): string;
  formatState(state: PipelineState): string;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates a formatter for the specified output mode.
 *
 * @param mode - 'json' or 'text'
 * @returns Formatter instance
 */
export function createFormatter(mode: OutputMode): Formatter {
  if (mode === 'json') {
    return {
      mode: 'json',
      formatContext: jsonFormatter.formatContextJson,
      formatDraft: jsonFormatter.formatDraftJson,
      formatFlavoured: jsonFormatter.formatFlavouredJson,
      formatDifficulty: jsonFormatter.formatDifficultyJson,
      formatBalanced: jsonFormatter.formatBalancedJson,
      formatState: jsonFormatter.formatStateJson,
    };
  }

  return {
    mode: 'text',
    formatContext: textFormatter.formatContextText,
    formatDraft: textFormatter.formatDraftText,
    formatFlavoured: textFormatter.formatFlavouredText,
    formatDifficulty: textFormatter.formatDifficultyText,
    formatBalanced: textFormatter.formatBalancedText,
    formatState: textFormatter.formatStateText,
  };
}
