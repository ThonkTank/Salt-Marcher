/**
 * Audio Feature exports.
 *
 * @see docs/features/Audio-System.md
 */

// Types
export type {
  AudioLayer,
  AudioLayerType,
  LocationType,
  WeatherType,
  MoodContext,
} from './types';

// Factory functions
export { createAudioLayer, createDefaultMoodContext } from './types';
