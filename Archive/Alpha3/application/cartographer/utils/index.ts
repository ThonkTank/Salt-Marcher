/**
 * Cartographer Utils - Internal utilities for brush and hit testing
 */

export {
  type FalloffType,
  type BrushMode,
  calculateFalloff,
  getFalloffTypes,
  getFalloffLabel,
  applyBrushValue,
  applyBrushIntValue,
  getBrushModes,
  getBrushModeLabel,
  calculateAverage,
  calculateWeightedAverage,
} from './brush-math';

export {
  type BrushCoord,
  getBrushCoords,
  getBrushCoordsFiltered,
  getBrushEdgeCoords,
  getNewTilesInBrush,
  getExistingNeighbors,
  filterNewStrokeCoords,
  createStrokeTracker,
} from './brush-geometry';

export {
  type CameraState,
  type HitTestResult,
  screenToWorld,
  worldToScreen,
  hitTestHex,
  hitTestHexBounded,
  getMousePosition,
  getTouchPosition,
  zoomAtPoint,
  clampZoom,
  calculateWheelZoom,
} from '@shared/map';
