/**
 * Map Module
 *
 * Consolidated map rendering utilities.
 * Provides SVG creation, hex rendering, colors, and interaction handling.
 */

// ═══════════════════════════════════════════════════════════════
// Canvas
// ═══════════════════════════════════════════════════════════════

export { BaseHexCanvas } from './canvas';
export {
  type TerrainColorInfo,
  type TerrainRegistry,
  type HexCanvasConfig,
  DEFAULT_HEX_CANVAS_CONFIG,
  HEX_STYLES,
} from './canvas';

// ═══════════════════════════════════════════════════════════════
// SVG Elements (Generic)
// ═══════════════════════════════════════════════════════════════

export {
  SVG_NS,
  createCircle,
  createPolyline,
  createLine,
  createText,
  createGroup,
  createPolygon,
  updateCirclePosition,
  updateCircleStyle,
  updateLinePosition,
  updatePolylinePoints,
  type CircleStyle,
  type PolylineStyle,
  type LineStyle,
  type TextStyle,
  type PolygonStyle,
} from './svg';

// ═══════════════════════════════════════════════════════════════
// SVG Elements (Hex-specific)
// ═══════════════════════════════════════════════════════════════

export {
  createHexPolygon,
  updateHexPolygonStyle,
  createBrushPreviewHex,
  createSelectionHighlight,
  createHoverHighlight,
  calculateGridBounds,
  getCoordFromElement,
  getKeyFromElement,
  type HexStyle,
  type HexGridConfig,
} from './svg';

// ═══════════════════════════════════════════════════════════════
// SVG Transform
// ═══════════════════════════════════════════════════════════════

export { createSvgRoot, applyCameraTransform } from './svg';

// ═══════════════════════════════════════════════════════════════
// Colors
// ═══════════════════════════════════════════════════════════════

export {
  getTileColor,
  elevationToColor,
  climateValueToColor,
  getColorModes,
  getColorModeLabel,
  type ColorMode,
} from './colors';

// ═══════════════════════════════════════════════════════════════
// Interaction
// ═══════════════════════════════════════════════════════════════

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
} from './interaction';
