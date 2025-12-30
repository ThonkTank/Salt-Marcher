// Terrain-Definition für Hex-Tiles
// Siehe: docs/entities/terrain-definition.md

export interface TerrainDefinition {
  id: string;
  threat: number;
  encounterChance?: number;
}
