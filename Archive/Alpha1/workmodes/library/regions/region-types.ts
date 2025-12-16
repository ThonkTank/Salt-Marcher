// src/workmodes/library/entities/regions/types.ts
// Type definitions for region entities

export interface RegionData {
  name: string;
  color?: string; // Hex color for region borders and labels (#RRGGBB)
  terrain: string; // Reference to terrain name
  encounter_odds?: number; // 1/N chance (e.g., 6 means 1/6)
  description?: string;
  biome_tags?: Array<{ value: string }>; // Classification: Forest, Mountain, Coastal, etc.
  danger_tags?: Array<{ value: string }>; // Danger level: Safe, Moderate, Dangerous, Deadly
  climate_tags?: Array<{ value: string }>; // Climate: Arctic, Cold, Temperate, Warm, Hot, Desert
  settlement_tags?: Array<{ value: string }>; // Settlement type: Civilized, Frontier, Wilderness, Ruins
  climate_template?: string; // Weather climate template: Arctic, Temperate, Tropical, Desert, Mountain, Coastal
}
