/**
 * Populate Command Handler
 *
 * CLI command for Steps 2-3: Creating an EncounterDraft from context.
 *
 * Usage: populate [--seed <creature-id>]
 */

import type { PipelineState } from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import type { Formatter } from '../output/index.js';
import {
  populateEncounter,
  getEligibleCreatures,
  type PopulationOptions,
} from '../pipeline/population.js';

// =============================================================================
// Types
// =============================================================================

export type CommandResult = 'continue' | 'exit';

// =============================================================================
// Command Handler
// =============================================================================

/**
 * Handles the 'populate' command.
 *
 * Creates an EncounterDraft from the current context and stores it in pipeline state.
 *
 * @param args - Positional arguments (unused)
 * @param flags - Command flags (--seed)
 * @param state - Pipeline state to update
 * @param lookups - Preset lookups for data access
 * @returns Command result
 */
export function handlePopulate(
  _args: string[],
  flags: Map<string, string | boolean>,
  state: PipelineState,
  lookups: PresetLookups,
  formatter: Formatter
): CommandResult {
  // Validate context exists
  if (!state.context) {
    console.log('\nError: No context available. Run "initiate" first.');
    printUsage();
    return 'continue';
  }

  // Get optional seed flag
  const seedId = flags.get('seed');
  const options: PopulationOptions = {};
  if (typeof seedId === 'string' && seedId) {
    options.seedId = seedId;
  }

  // Show eligible creatures for debugging
  if (flags.has('verbose') || flags.has('v')) {
    const creatures = Array.from(lookups.creatures.values());
    const eligible = getEligibleCreatures(state.context, creatures, lookups.factions);
    console.log(`\n[Debug] Eligible creatures: ${eligible.length}`);
    for (const wc of eligible.slice(0, 10)) {
      console.log(`  - ${wc.creature.id} (weight: ${wc.weight.toFixed(2)})`);
    }
    if (eligible.length > 10) {
      console.log(`  ... and ${eligible.length - 10} more`);
    }
  }

  // Populate encounter
  const result = populateEncounter(state.context, lookups, options);

  if (result.success === false) {
    console.log(`\nError: ${result.error}\n`);
    return 'continue';
  }

  // Store in state
  const { draft } = result;
  state.draft = draft;

  // Clear downstream state (draft changed)
  state.flavoured = undefined;
  state.difficulty = undefined;
  state.balanced = undefined;

  // Output success using formatter
  console.log(formatter.formatDraft(draft));

  return 'continue';
}

// =============================================================================
// Help
// =============================================================================

/**
 * Prints usage information for the populate command.
 */
function printUsage(): void {
  console.log('\nUsage: populate [--seed <creature-id>] [--verbose]');
  console.log('\nFlags:');
  console.log('  --seed <id>   Optional. Force a specific creature as seed.');
  console.log('  --verbose     Optional. Show eligible creatures before selection.');
  console.log('');
  console.log('Prerequisites:');
  console.log('  Run "initiate" first to create an EncounterContext.');
  console.log('');
}
