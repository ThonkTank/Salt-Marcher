/**
 * Audio Feature types and interfaces.
 *
 * The Audio Feature provides background music and ambient sounds
 * with automatic mood-based track selection.
 *
 * @see docs/features/Audio-System.md
 */

import type { EntityId, TimeSegment } from '@core/index';

// ============================================================================
// Layer Types
// ============================================================================

/**
 * Audio layer type.
 * - music: Background music tracks
 * - ambience: Environmental sounds (usually looped)
 */
export type AudioLayerType = 'music' | 'ambience';

/**
 * Audio layer with HTMLAudioElement for playback.
 * Each layer can play one track at a time.
 *
 * @see Audio-System.md#audio-layers
 */
export interface AudioLayer {
  /** Layer type */
  layer: AudioLayerType;

  /** HTML5 Audio element for playback */
  element: HTMLAudioElement;

  /** Currently playing track ID (if any) */
  currentTrackId?: EntityId<'track'>;

  /** Volume level (0-1, where 1 is 100%) */
  volume: number;
}

/**
 * Create a new audio layer with default settings.
 *
 * @param type - Layer type ('music' or 'ambience')
 * @returns Initialized AudioLayer
 *
 * @example
 * ```typescript
 * const musicLayer = createAudioLayer('music');
 * const ambienceLayer = createAudioLayer('ambience');
 * ```
 */
export function createAudioLayer(type: AudioLayerType): AudioLayer {
  return {
    layer: type,
    element: new Audio(),
    currentTrackId: undefined,
    // Default volumes from Audio-System.md#settings
    volume: type === 'music' ? 0.7 : 0.5,
  };
}

// ============================================================================
// Location Types (for Mood-Matching)
// ============================================================================

/**
 * Location types for audio mood-matching.
 * From Audio-System.md#schemas
 *
 * Used to match tracks with location-based tags.
 */
export type LocationType =
  | 'wilderness'
  | 'forest'
  | 'mountain'
  | 'desert'
  | 'swamp'
  | 'coast'
  | 'town'
  | 'tavern'
  | 'dungeon'
  | 'cave';

// ============================================================================
// Weather Types (for Mood-Matching)
// ============================================================================

/**
 * Simplified weather types for audio mood-matching.
 * Derived from PrecipitationType but simplified for track-tag matching.
 *
 * @see Audio-System.md#schemas
 * @see Track.tags.weather
 */
export type WeatherType = 'clear' | 'rain' | 'storm' | 'snow' | 'fog';

// ============================================================================
// Mood Context
// ============================================================================

/**
 * Context for automatic track selection (mood-matching).
 * The Audio feature uses this to select appropriate tracks.
 *
 * Task #1102 - MoodContext Interface
 * @see Audio-System.md#schemas
 * @see Audio-System.md#mood-matching
 */
export interface MoodContext {
  /** Current location type (e.g., "tavern", "dungeon") */
  location: LocationType;

  /** Current weather condition (simplified) */
  weather: WeatherType;

  /** Current time of day segment */
  timeOfDay: TimeSegment;

  /** Combat state - idle or active combat */
  combatState: 'idle' | 'active';
}

/**
 * Create a default MoodContext.
 * Useful for initialization.
 *
 * @returns Default MoodContext (wilderness, clear, morning, idle)
 */
export function createDefaultMoodContext(): MoodContext {
  return {
    location: 'wilderness',
    weather: 'clear',
    timeOfDay: 'morning',
    combatState: 'idle',
  };
}
