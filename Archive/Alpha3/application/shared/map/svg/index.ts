/**
 * SVG Module
 *
 * Re-exports all SVG utilities for map rendering.
 */

// Generic SVG elements
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
} from './elements';

// Hex-specific SVG
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
} from './hex';

// Transform utilities
export { createSvgRoot, applyCameraTransform } from './transform';
