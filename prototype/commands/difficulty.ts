/**
 * Difficulty Command Handler
 *
 * CLI command for Step 5: Difficulty Calculation
 * Calculates encounter difficulty using CR-based XP thresholds.
 */

import type { PipelineState } from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import type { Formatter } from '../output/index.js';
import { calculateDifficulty } from '../pipeline/difficulty.js';

/**
 * Handles the 'difficulty' command.
 *
 * Usage: difficulty
 *
 * Requires a flavoured encounter from the 'flavour' command.
 */
export function handleDifficulty(
  _args: string[],
  _flags: Record<string, string>,
  state: PipelineState,
  lookups: PresetLookups,
  formatter: Formatter
): string {
  // Check prerequisites
  if (!state.flavoured) {
    return 'Error: No flavoured encounter available. Run "flavour" first.';
  }

  // Execute difficulty calculation
  const result = calculateDifficulty(state.flavoured, lookups);

  if (!result.success) {
    return `Error: ${result.error}`;
  }

  // Update state
  state.difficulty = result.result;

  // Clear downstream state (balanced)
  state.balanced = undefined;

  return formatter.formatDifficulty(result.result);
}
