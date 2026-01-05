// Ziel: Grid-Space Service Index
// Siehe: docs/services/gridSpace.md

export {
  // Types
  type GridPosition,
  type GridConfig,
  type PositionedCombatant,
  // Constants
  GRID_MARGIN_CELLS,
  DEFAULT_ENCOUNTER_DISTANCE_FEET,
  DEFAULT_ENCOUNTER_DISTANCE_CELLS,
  // Grid Initialization
  initializeGrid,
  // Positioning
  spreadFormation,
  calculateInitialPositions,
  // Cell Enumeration
  getRelevantCells,
  getCellsInRange,
} from './gridSpace';
