// src/workmodes/library/entities/regions/constants.ts
// Constants and types for region creation UI

export const ENCOUNTER_ODDS_PRESETS = [
  { value: 0, label: "No encounters" },
  { value: 20, label: "Very rare (1/20)" },
  { value: 12, label: "Rare (1/12)" },
  { value: 8, label: "Uncommon (1/8)" },
  { value: 6, label: "Common (1/6)" },
  { value: 4, label: "Frequent (1/4)" },
  { value: 2, label: "Very frequent (1/2)" },
] as const;
export type EncounterOddsPreset = (typeof ENCOUNTER_ODDS_PRESETS)[number];

// Common terrain types for suggestions
export const TERRAIN_SUGGESTIONS = [
  "Wald",
  "Meer",
  "Berg",
  "Wüste",
  "Grasland",
  "Sumpf",
  "Küste",
  "Stadt",
  "Ruinen",
  "Höhlen",
] as const;
export type TerrainSuggestion = (typeof TERRAIN_SUGGESTIONS)[number];
