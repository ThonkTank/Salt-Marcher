/**
 * Initiate Command Handler
 *
 * CLI command for Step 1: Creating an EncounterContext.
 *
 * Usage: initiate --terrain <id> --time <segment> [--trigger <type>]
 */

import type { PipelineState, TimeSegment } from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import {
  createContext,
  getAvailableTimeSegments,
  getAvailableTriggers,
  type InitiationOptions,
} from '../pipeline/initiation.js';

// =============================================================================
// Types
// =============================================================================

export type CommandResult = 'continue' | 'exit';

// =============================================================================
// Command Handler
// =============================================================================

/**
 * Handles the 'initiate' command.
 *
 * Creates an EncounterContext from CLI flags and stores it in the pipeline state.
 *
 * @param args - Positional arguments (unused)
 * @param flags - Command flags (--terrain, --time, --trigger)
 * @param state - Pipeline state to update
 * @param lookups - Preset lookups for data access
 * @returns Command result
 */
export function handleInitiate(
  _args: string[],
  flags: Map<string, string | boolean>,
  state: PipelineState,
  lookups: PresetLookups
): CommandResult {
  // Get required flags
  const terrainId = flags.get('terrain');
  const time = flags.get('time');
  const trigger = flags.get('trigger');

  // Validate required flags
  if (typeof terrainId !== 'string' || !terrainId) {
    console.log('\nError: --terrain is required.');
    printUsage();
    return 'continue';
  }

  if (typeof time !== 'string' || !time) {
    console.log('\nError: --time is required.');
    printUsage();
    return 'continue';
  }

  // Build options
  const options: InitiationOptions = {
    terrainId,
    time: time as TimeSegment,
    triggeredBy: typeof trigger === 'string' ? (trigger as InitiationOptions['triggeredBy']) : undefined,
  };

  // Create context
  const result = createContext(options, lookups);

  if (result.success === false) {
    console.log(`\nError: ${result.error}\n`);
    return 'continue';
  }

  // Store in state (result.success === true here)
  const { context } = result;
  state.context = context;

  // Clear downstream state (context changed, so draft etc. are invalid)
  state.draft = undefined;
  state.flavoured = undefined;
  state.difficulty = undefined;
  state.balanced = undefined;

  // Output success
  console.log('\n=== EncounterContext Created ===\n');
  console.log(`  Terrain:     ${context.terrain.name} (${context.terrain.id})`);
  console.log(`  Time:        ${context.time}`);
  console.log(`  Trigger:     ${context.triggeredBy}`);
  console.log(`  Party Size:  ${context.party.size} (avg level ${context.party.averageLevel})`);
  console.log(`  Features:    ${context.features.length} (aggregation not yet implemented)`);
  if (context.weather) {
    console.log(`  Weather:     ${context.weather.precipitation}, visibility ${context.weather.visibility}`);
  } else {
    console.log(`  Weather:     (not set)`);
  }
  console.log('\nNext step: populate [--seed <creature-id>]\n');

  return 'continue';
}

// =============================================================================
// Help
// =============================================================================

/**
 * Prints usage information for the initiate command.
 */
function printUsage(): void {
  const timeSegments = getAvailableTimeSegments().join('|');
  const triggers = getAvailableTriggers().join('|');

  console.log('\nUsage: initiate --terrain <id> --time <segment> [--trigger <type>]');
  console.log('\nFlags:');
  console.log(`  --terrain <id>      Required. Terrain ID from presets.`);
  console.log(`  --time <segment>    Required. Time of day: ${timeSegments}`);
  console.log(`  --trigger <type>    Optional. Trigger type: ${triggers} (default: manual)`);
  console.log('');
}
