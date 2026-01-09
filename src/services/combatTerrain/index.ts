// Ziel: Combat Terrain Service Index
// Siehe: docs/services/combatTracking.md
//
// Re-exports für Combat Terrain Service:
// - terrainMovement: Dijkstra-Pathfinding mit Terrain-Kosten
// - terrainEffects: Terrain Effect Trigger System

export {
  // Types
  type ReachableCell,
  // Size Helpers
  getCombatantSizeIndex,
  // Movement Cost
  getMovementCost,
  isCellOccupiedByEnemy,
  // Pathfinding
  getReachableCellsWithTerrain,
  getReachablePositionsWithTerrain,
} from './terrainMovement';

export {
  // Types
  type TerrainTrigger,
  type TerrainEffectResult,
  type TeleportResult,
  // Effect Application
  applyTerrainEffects,
} from './terrainEffects';

export {
  // Cell Validation
  isCellWalkable,
  isWithinBounds,
  // Spawn Positioning
  findValidSpawnCells,
  calculateSpawnPositions,
} from './spawnHelpers';
