/**
 * SVG Transform Utilities
 *
 * Provides SVG root creation and camera transform functions.
 */

import { SVG_NS } from './elements';

// ═══════════════════════════════════════════════════════════════
// SVG Root
// ═══════════════════════════════════════════════════════════════

/**
 * Create an SVG root element for hex grid
 *
 * @param width - SVG width in pixels
 * @param height - SVG height in pixels
 * @param viewBox - Optional viewBox string (default: derived from width/height)
 * @returns SVG root element
 */
export function createSvgRoot(
  width: number,
  height: number,
  viewBox?: string
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', width.toString());
  svg.setAttribute('height', height.toString());
  svg.setAttribute('viewBox', viewBox ?? `0 0 ${width} ${height}`);
  svg.style.overflow = 'hidden';
  return svg;
}

// ═══════════════════════════════════════════════════════════════
// Camera Transform
// ═══════════════════════════════════════════════════════════════

/**
 * Apply camera transform to an SVG group
 *
 * @param group - SVG group to transform
 * @param panX - Pan offset X
 * @param panY - Pan offset Y
 * @param zoom - Zoom factor
 * @param centerX - Center X for zoom origin
 * @param centerY - Center Y for zoom origin
 */
export function applyCameraTransform(
  group: SVGGElement,
  panX: number,
  panY: number,
  zoom: number,
  centerX: number,
  centerY: number
): void {
  // Transform: translate to center, scale, translate back, then pan
  group.setAttribute(
    'transform',
    `translate(${centerX + panX}, ${centerY + panY}) scale(${zoom})`
  );
}
