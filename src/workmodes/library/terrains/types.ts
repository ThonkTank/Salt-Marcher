// src/workmodes/library/entities/terrains/types.ts
// Type definitions for terrain entities

export interface TerrainData {
  name: string;
  display_name?: string; // For empty terrain: "(default)"
  color: string; // Hex color or "transparent"
  speed: number; // Movement multiplier (0.1 - 1.0)
  biome_tags?: Array<{ value: string }>; // Classification: Forest, Mountain, Coastal, etc.
  difficulty_tags?: Array<{ value: string }>; // Difficulty: Easy, Difficult, Very Difficult
}
