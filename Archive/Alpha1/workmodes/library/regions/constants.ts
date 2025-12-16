// src/workmodes/library/entities/regions/constants.ts
// Constants and types for region creation UI

// Region tags (for classification and filtering)
// Based on docs/TAGS.md
export const REGION_BIOME_TAGS = [
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
export type RegionBiomeTag = (typeof REGION_BIOME_TAGS)[number];

export const REGION_DANGER_TAGS = [
  "Safe",
  "Moderate",
  "Dangerous",
  "Deadly",
] as const;
export type RegionDangerTag = (typeof REGION_DANGER_TAGS)[number];

export const REGION_CLIMATE_TAGS = [
  "Arctic",
  "Cold",
  "Temperate",
  "Warm",
  "Hot",
  "Desert",
] as const;
export type RegionClimateTag = (typeof REGION_CLIMATE_TAGS)[number];

export const REGION_SETTLEMENT_TAGS = [
  "Civilized",
  "Frontier",
  "Wilderness",
  "Ruins",
] as const;
export type RegionSettlementTag = (typeof REGION_SETTLEMENT_TAGS)[number];

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

// Climate templates for weather generation
export const CLIMATE_TEMPLATES = [
  "Arctic",
  "Temperate",
  "Tropical",
  "Desert",
  "Mountain",
  "Coastal",
] as const;
export type ClimateTemplate = (typeof CLIMATE_TEMPLATES)[number];
