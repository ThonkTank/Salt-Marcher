// src/workmodes/library/entities/terrains/constants.ts
// Constants and types for terrain creation UI

// Terrain tags (for classification and filtering)
// Based on docs/TAGS.md
export const TERRAIN_BIOME_TAGS = [
  "Forest",
  "Mountain",
  "Coastal",
  "Desert",
  "Arctic",
  "Swamp",
  "Grassland",
  "Hills",
  "Urban",
  "Underground",
] as const;
export type TerrainBiomeTag = (typeof TERRAIN_BIOME_TAGS)[number];

export const TERRAIN_DIFFICULTY_TAGS = [
  "Easy",
  "Difficult",
  "Very Difficult",
] as const;
export type TerrainDifficultyTag = (typeof TERRAIN_DIFFICULTY_TAGS)[number];

export const TERRAIN_COLOR_PRESETS = [
  "transparent",
  "#2e7d32", // Wald grün
  "#0288d1", // Meer blau
  "#6d4c41", // Berg braun
  "#ffeb3b", // Wüste gelb
  "#9e9e9e", // Gebirge grau
  "#757575", // Stein grau
  "#795548", // Erde braun
  "#4caf50", // Gras grün
  "#00bcd4", // Eis cyan
] as const;
export type TerrainColor = (typeof TERRAIN_COLOR_PRESETS)[number];

export const SPEED_PRESETS = [
  { value: 1.0, label: "Normal (100%)" },
  { value: 0.8, label: "Leicht schwierig (80%)" },
  { value: 0.6, label: "Schwierig (60%)" },
  { value: 0.4, label: "Sehr schwierig (40%)" },
  { value: 0.2, label: "Extrem schwierig (20%)" },
] as const;
export type SpeedPreset = (typeof SPEED_PRESETS)[number];
