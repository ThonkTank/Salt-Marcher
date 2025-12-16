/**
 * Interaction Module
 *
 * Re-exports hit testing and zoom utilities.
 */

export {
  screenToWorld,
  worldToScreen,
  hitTestHex,
  hitTestHexBounded,
  getMousePosition,
  getTouchPosition,
  zoomAtPoint,
  clampZoom,
  calculateWheelZoom,
  type CameraState,
  type HitTestResult,
} from './hit-testing';
