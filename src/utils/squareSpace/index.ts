// Square Space Utils Index
// Siehe: docs/utils/grid.md

export {
  type GridPosition,
  type DiagonalRule,
  type GridConfig,
  type SpeedBlock,
  type Vector3Feet,
  createGrid,
  cellToFeet,
  feetToCell,
  positionToFeet,
  feetToPosition,
  getDistance,
  getDistanceFeet,
  isWithinBounds,
  clampToGrid,
  getNeighbors,
  getNeighbors3D,
  filterInBounds,
  spreadFormation,
  positionOpposingSides,
  positionToKey,
  keyToPosition,
  positionsEqual,
  getDirection,
  stepToward,
  // Movement & Range utilities
  getOffsetPattern,
  getRelevantCells,
  calculateMovementDecay,
} from './grid';

export {
  type RayCastResult,
  type CoverLevel,
  type CellBlocker,
  rayCast,
  getVisibleCells,
  calculateCover,
  hasLineOfSight,
  getLineCells,
} from './gridLineOfSight';
