/**
 * Encounter Pipeline Step 1: Initiation
 *
 * Creates the EncounterContext from CLI arguments and preset data.
 * This is the first step in the 7-step pipeline.
 */

import type {
  EncounterContext,
  Terrain,
  TimeSegment,
  WeatherState,
  PartySnapshot,
  Feature,
} from '../types/encounter.js';
import type { PresetLookups } from '../loaders/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating an encounter context.
 */
export interface InitiationOptions {
  /** Terrain ID from presets */
  terrainId: string;
  /** Time of day segment */
  time: TimeSegment;
  /** Optional weather state */
  weather?: WeatherState;
  /** Trigger type (default: 'manual') */
  triggeredBy?: EncounterContext['triggeredBy'];
}

/**
 * Result of context creation.
 */
export type InitiationResult =
  | { success: true; context: EncounterContext }
  | { success: false; error: string };

// =============================================================================
// Validation
// =============================================================================

const VALID_TIME_SEGMENTS: TimeSegment[] = [
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'night',
];

const VALID_TRIGGERS: EncounterContext['triggeredBy'][] = [
  'travel',
  'location',
  'quest',
  'manual',
  'time',
];

/**
 * Validates that a string is a valid TimeSegment.
 */
export function isValidTimeSegment(value: string): value is TimeSegment {
  return VALID_TIME_SEGMENTS.includes(value as TimeSegment);
}

/**
 * Validates that a string is a valid trigger type.
 */
export function isValidTrigger(
  value: string
): value is EncounterContext['triggeredBy'] {
  return VALID_TRIGGERS.includes(value as EncounterContext['triggeredBy']);
}

// =============================================================================
// Context Creation
// =============================================================================

/**
 * Creates an EncounterContext from the given options.
 *
 * @param options - Configuration for the context
 * @param lookups - Preset lookups for terrain and party data
 * @returns Result with context or error message
 */
export function createContext(
  options: InitiationOptions,
  lookups: PresetLookups
): InitiationResult {
  // Validate terrain exists
  const terrain = lookups.terrains.get(options.terrainId);
  if (!terrain) {
    const available = Array.from(lookups.terrains.keys()).join(', ');
    return {
      success: false,
      error: `Unknown terrain: "${options.terrainId}". Available: ${available}`,
    };
  }

  // Validate time segment
  if (!isValidTimeSegment(options.time)) {
    return {
      success: false,
      error: `Invalid time segment: "${options.time}". Valid: ${VALID_TIME_SEGMENTS.join(', ')}`,
    };
  }

  // Validate trigger if provided
  const triggeredBy = options.triggeredBy ?? 'manual';
  if (!isValidTrigger(triggeredBy)) {
    return {
      success: false,
      error: `Invalid trigger: "${triggeredBy}". Valid: ${VALID_TRIGGERS.join(', ')}`,
    };
  }

  // Get party from lookups
  const party: PartySnapshot = lookups.party;

  // Features are empty for now (Feature entity type not yet implemented)
  // In future: aggregate from terrain.features + weather.activeFeatures
  const features: Feature[] = [];

  // Build context
  const context: EncounterContext = {
    terrain,
    time: options.time,
    weather: options.weather,
    party,
    features,
    triggeredBy,
  };

  return { success: true, context };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Returns a list of available time segments for help text.
 */
export function getAvailableTimeSegments(): readonly TimeSegment[] {
  return VALID_TIME_SEGMENTS;
}

/**
 * Returns a list of available trigger types for help text.
 */
export function getAvailableTriggers(): readonly EncounterContext['triggeredBy'][] {
  return VALID_TRIGGERS;
}
