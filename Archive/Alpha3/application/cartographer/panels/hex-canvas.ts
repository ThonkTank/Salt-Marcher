/**
 * Hex Canvas Component (Cartographer)
 *
 * Extends BaseHexCanvas with editing-specific features:
 * - Brush preview overlay
 * - Selection highlight
 *
 * For map editing in Cartographer workmode.
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import { hexToPixel, hexPolygonPoints } from '@core/schemas/hex-geometry';
import { BaseHexCanvas, type HexCanvasConfig } from '@shared/map';
import type { BrushCoord } from '../utils/brush-geometry';

// ═══════════════════════════════════════════════════════════════
// Constants (Cartographer-specific)
// ═══════════════════════════════════════════════════════════════

const SELECTION_STROKE = '#ffff00';
const SELECTION_STROKE_WIDTH = 3;
const BRUSH_PREVIEW_COLOR = 'rgba(255, 255, 255, 0.3)';

// ═══════════════════════════════════════════════════════════════
// Hex Canvas (Cartographer)
// ═══════════════════════════════════════════════════════════════

export class HexCanvas extends BaseHexCanvas {
  constructor(container: HTMLElement, hexSize = 42) {
    super(container, { hexSize });
    this.setupLayers();
    this.initializeSvg();
  }

  // ─────────────────────────────────────────────────────────────
  // BaseHexCanvas Abstract Implementation
  // ─────────────────────────────────────────────────────────────

  protected setupLayers(): void {
    // Cartographer uses simple 2-layer structure: tiles + overlay
    // (overlay is added by initializeSvg)
  }

  protected getTransformGroups(): SVGGElement[] {
    // Both tile and overlay groups need camera transform
    return [this.tileGroup, this.overlayGroup];
  }

  // ─────────────────────────────────────────────────────────────
  // Cartographer-Specific: Brush Preview
  // ─────────────────────────────────────────────────────────────

  /**
   * Update brush preview overlay
   */
  updateBrushPreview(brushCoords: BrushCoord[]): void {
    // Clear existing preview
    this.clearOverlay();

    for (const bc of brushCoords) {
      const { x, y } = hexToPixel(bc.coord, this.hexSize);
      const points = hexPolygonPoints(x, y, this.hexSize);

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', points);
      polygon.setAttribute('fill', BRUSH_PREVIEW_COLOR);
      polygon.setAttribute('stroke', '#ffffff');
      polygon.setAttribute('stroke-width', '2');
      polygon.setAttribute('opacity', bc.falloff.toString());
      polygon.classList.add('brush-preview');

      this.overlayGroup.appendChild(polygon);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Cartographer-Specific: Selection Highlight
  // ─────────────────────────────────────────────────────────────

  /**
   * Show selection highlight on a hex
   */
  showSelectionHighlight(coord: HexCoordinate): void {
    this.removeOverlayByClass('selection-highlight');

    const { x, y } = hexToPixel(coord, this.hexSize);
    const points = hexPolygonPoints(x, y, this.hexSize);

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('fill', 'transparent');
    polygon.setAttribute('stroke', SELECTION_STROKE);
    polygon.setAttribute('stroke-width', SELECTION_STROKE_WIDTH.toString());
    polygon.classList.add('selection-highlight');

    this.overlayGroup.appendChild(polygon);
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new hex canvas for Cartographer
 */
export function createHexCanvas(container: HTMLElement, hexSize?: number): HexCanvas {
  return new HexCanvas(container, hexSize);
}
