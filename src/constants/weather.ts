// Ziel: Konstanten für Weather-Faktor-Generierung
// Siehe: docs/services/Weather.md

// ============================================================================
// TEMPERATURE MODIFIERS
// ============================================================================

/** Temperatur-Offset nach Jahreszeit in °C */
export const SEASON_TEMPERATURE_OFFSET = {
  spring: 0,
  summer: 10,
  autumn: -5,
  winter: -15,
} as const;
export type Season = keyof typeof SEASON_TEMPERATURE_OFFSET;

/** Temperatur-Offset nach Tageszeit in °C (Keys = TimeSegment aus ./time.ts) */
export const TIME_TEMPERATURE_OFFSET = {
  dawn: -5,
  morning: 0,
  midday: 5,
  afternoon: 0,
  dusk: -5,
  night: -10,
} as const;

/** Temperatur-Änderung pro 1000m Höhe in °C */
export const ELEVATION_TEMPERATURE_FACTOR = -6.5;

// ============================================================================
// WIND CATEGORIES (für Gameplay-Effekte)
// ============================================================================

export const WIND_CATEGORIES = {
  calm: { max: 10, label: 'Windstill' },
  light: { max: 30, label: 'Leicht' },
  moderate: { max: 50, label: 'Mäßig' },
  strong: { max: 70, label: 'Stark' },
  gale: { max: 150, label: 'Sturm' },
} as const;

// ============================================================================
// TEMPERATURE CATEGORIES (für Gameplay-Effekte)
// ============================================================================

export const TEMPERATURE_CATEGORIES = {
  freezing: { max: -10, label: 'Eisig' },
  cold: { max: 5, label: 'Kalt' },
  cool: { max: 15, label: 'Kühl' },
  mild: { max: 25, label: 'Mild' },
  warm: { max: 35, label: 'Warm' },
  hot: { max: 60, label: 'Heiß' },
} as const;

// ============================================================================
// DEFAULT PRESSURE RANGES (für Terrains ohne eigene Definition)
// ============================================================================

export const DEFAULT_PRESSURE_RANGE = {
  min: -0.3,
  average: 0.1,
  max: 0.5,
} as const;

export const MOUNTAIN_PRESSURE_RANGE = {
  min: -0.5,
  average: -0.2,
  max: 0.3,
} as const;

export const COAST_PRESSURE_RANGE = {
  min: -0.3,
  average: 0,
  max: 0.5,
} as const;
