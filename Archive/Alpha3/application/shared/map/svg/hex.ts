/**
 * SVG Hex Utilities
 *
 * Provides SVG element creation for hex grid rendering.
 * Used by Cartographer (editing) and SessionRunner (display).
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import {
  hexToPixel,
  hexPolygonPoints,
  hexWidth,
  hexHeight,
  coordToKey,
  type CoordKey,
} from '@core/schemas/hex-geometry';
import { SVG_NS, createPolygon, type PolygonStyle } from './elements';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface HexStyle {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export interface HexGridConfig {
  hexSize: number;
  defaultStroke?: string;
  defaultStrokeWidth?: number;
}

// ═══════════════════════════════════════════════════════════════
// SVG Element Creation
// ═══════════════════════════════════════════════════════════════

/**
 * Create an SVG polygon element for a hex
 *
 * @param coord - Hex coordinate
 * @param hexSize - Size of hex (center to corner)
 * @param style - Visual style options
 * @returns SVG polygon element
 */
export function createHexPolygon(
  coord: HexCoordinate,
  hexSize: number,
  style: HexStyle
): SVGPolygonElement {
  const { x, y } = hexToPixel(coord, hexSize);
  const points = hexPolygonPoints(x, y, hexSize);

  const polygon = createPolygon(points, style as PolygonStyle);
  polygon.setAttribute('data-q', coord.q.toString());
  polygon.setAttribute('data-r', coord.r.toString());
  polygon.setAttribute('data-key', coordToKey(coord));

  return polygon;
}

/**
 * Update an existing hex polygon's visual properties
 *
 * @param polygon - The SVG polygon to update
 * @param style - New style properties
 */
export function updateHexPolygonStyle(
  polygon: SVGPolygonElement,
  style: Partial<HexStyle>
): void {
  if (style.fill !== undefined) {
    polygon.setAttribute('fill', style.fill);
  }
  if (style.stroke !== undefined) {
    polygon.setAttribute('stroke', style.stroke);
  }
  if (style.strokeWidth !== undefined) {
    polygon.setAttribute('stroke-width', style.strokeWidth.toString());
  }
  if (style.opacity !== undefined) {
    polygon.setAttribute('opacity', style.opacity.toString());
  }
  if (style.className !== undefined) {
    polygon.setAttribute('class', style.className);
  }
}

// ═══════════════════════════════════════════════════════════════
// Overlay Elements
// ═══════════════════════════════════════════════════════════════

/**
 * Create a brush preview overlay polygon
 *
 * @param coord - Hex coordinate
 * @param hexSize - Size of hex
 * @param opacity - Preview opacity (0-1)
 * @returns SVG polygon element
 */
export function createBrushPreviewHex(
  coord: HexCoordinate,
  hexSize: number,
  opacity: number
): SVGPolygonElement {
  return createHexPolygon(coord, hexSize, {
    fill: 'rgba(255, 255, 255, 0.3)',
    stroke: '#ffffff',
    strokeWidth: 2,
    opacity,
    className: 'brush-preview',
  });
}

/**
 * Create a selection highlight polygon
 *
 * @param coord - Hex coordinate
 * @param hexSize - Size of hex
 * @returns SVG polygon element
 */
export function createSelectionHighlight(
  coord: HexCoordinate,
  hexSize: number
): SVGPolygonElement {
  return createHexPolygon(coord, hexSize, {
    fill: 'transparent',
    stroke: '#ffff00',
    strokeWidth: 3,
    className: 'selection-highlight',
  });
}

/**
 * Create a hover highlight polygon
 *
 * @param coord - Hex coordinate
 * @param hexSize - Size of hex
 * @returns SVG polygon element
 */
export function createHoverHighlight(
  coord: HexCoordinate,
  hexSize: number
): SVGPolygonElement {
  return createHexPolygon(coord, hexSize, {
    fill: 'rgba(255, 255, 255, 0.15)',
    stroke: '#ffffff',
    strokeWidth: 1,
    className: 'hover-highlight',
  });
}

// ═══════════════════════════════════════════════════════════════
// Grid Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate the bounding box for a set of hex coordinates
 *
 * @param coords - Array of hex coordinates
 * @param hexSize - Size of hex
 * @param padding - Extra padding around bounds
 * @returns Bounding box { minX, minY, maxX, maxY, width, height }
 */
export function calculateGridBounds(
  coords: HexCoordinate[],
  hexSize: number,
  padding = 0
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (coords.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  const halfWidth = hexWidth(hexSize) / 2;
  const halfHeight = hexHeight(hexSize) / 2;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const coord of coords) {
    const { x, y } = hexToPixel(coord, hexSize);
    minX = Math.min(minX, x - halfWidth);
    minY = Math.min(minY, y - halfHeight);
    maxX = Math.max(maxX, x + halfWidth);
    maxY = Math.max(maxY, y + halfHeight);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  };
}

/**
 * Get coordinate from a hex polygon element's data attributes
 *
 * @param element - SVG polygon element with data-q and data-r attributes
 * @returns Hex coordinate or null if invalid
 */
export function getCoordFromElement(element: Element): HexCoordinate | null {
  const qStr = element.getAttribute('data-q');
  const rStr = element.getAttribute('data-r');

  if (qStr === null || rStr === null) {
    return null;
  }

  const q = parseInt(qStr, 10);
  const r = parseInt(rStr, 10);

  if (isNaN(q) || isNaN(r)) {
    return null;
  }

  return { q, r };
}

/**
 * Get CoordKey from a hex polygon element
 *
 * @param element - SVG polygon element with data-key attribute
 * @returns CoordKey or null if invalid
 */
export function getKeyFromElement(element: Element): CoordKey | null {
  const key = element.getAttribute('data-key');
  return key as CoordKey | null;
}
