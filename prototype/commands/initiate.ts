/**
 * Initiate Command Handler
 *
 * CLI command for Step 1: Creating an EncounterContext.
 *
 * Usage: initiate --terrain <id> --time <segment> [--trigger <type>]
 */

import type { PipelineState, TimeSegment, WeatherState } from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';
import type { Formatter } from '../output/index.js';
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
  lookups: PresetLookups,
  formatter: Formatter
): CommandResult {
  // Get required flags
  const terrainId = flags.get('terrain');
  const time = flags.get('time');
  const trigger = flags.get('trigger');

  // Get optional weather flags
  const precipitation = flags.get('precipitation') as string | undefined;
  const visibility = flags.get('visibility') as string | undefined;
  const temperature = flags.get('temperature') as string | undefined;

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

  // Build weather state if any weather flags provided
  let weather: WeatherState | undefined;
  if (precipitation || visibility || temperature) {
    weather = {
      temperature: temperature ? parseInt(temperature, 10) : 15,
      windSpeed: 10,
      precipitation: (precipitation as WeatherState['precipitation']) ?? 'none',
      visibility: (visibility as WeatherState['visibility']) ?? 'clear',
    };
  }

  // Build options
  const options: InitiationOptions = {
    terrainId,
    time: time as TimeSegment,
    weather,
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

  // Output success using formatter
  console.log(formatter.formatContext(context));

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

  console.log('\nUsage: initiate --terrain <id> --time <segment> [options]');
  console.log('\nRequired:');
  console.log(`  --terrain <id>         Terrain ID from presets.`);
  console.log(`  --time <segment>       Time of day: ${timeSegments}`);
  console.log('\nOptional:');
  console.log(`  --trigger <type>       Trigger type: ${triggers} (default: manual)`);
  console.log(`  --precipitation <X>    Weather: none|light|moderate|heavy`);
  console.log(`  --visibility <X>       Visibility: clear|reduced|poor`);
  console.log(`  --temperature <N>      Temperature in Celsius (affects cold/snow/hot)`);
  console.log('');
}
