/**
 * Flavour Command Handler
 *
 * CLI command for Step 4: Flavour
 * Enriches EncounterDraft with activity, goal, NPC, and loot.
 */

import type { PipelineState } from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import type { Formatter } from '../output/index.js';
import { flavourEncounter } from '../pipeline/flavour.js';

/**
 * Handles the 'flavour' command.
 *
 * Usage: flavour [--budget <gold>]
 *
 * Flags:
 *   --budget <gold>  Loot budget in gold pieces (default: 500)
 *
 * Requires a populated draft from the 'populate' command.
 */
export function handleFlavour(
  _args: string[],
  flags: Record<string, string>,
  state: PipelineState,
  lookups: PresetLookups,
  formatter: Formatter
): string {
  // Check prerequisites
  if (!state.draft) {
    return 'Error: No draft available. Run "populate" first.';
  }

  // Parse budget flag
  const budget = flags['budget'] ? parseInt(flags['budget'], 10) : undefined;
  if (flags['budget'] && (isNaN(budget!) || budget! < 0)) {
    return 'Error: --budget must be a positive number.';
  }

  // Execute flavour step with options
  const result = flavourEncounter(state.draft, lookups, { budget });

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  // Update state
  state.flavoured = result.encounter;

  // Clear downstream state (difficulty, balanced)
  state.difficulty = undefined;
  state.balanced = undefined;

  return formatter.formatFlavoured(result.encounter);
}
