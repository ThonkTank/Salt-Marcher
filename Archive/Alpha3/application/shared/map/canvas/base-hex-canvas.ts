/**
 * Base Hex Canvas
 *
 * Abstract base class for hex map rendering.
 * Provides common functionality for tile rendering, camera, and overlays.
 *
 * Extended by:
 * - HexCanvas (Cartographer) - adds editing features
 * - MapCanvas (SessionRunner) - adds multi-layer support
 */

import type { HexCoordinate } from '@core/schemas/coordinates';
import type { HexTileData, HexMapData } from '@core/schemas/map';
import {
  coordToKey,
  hexToPixel,
  hexPolygonPoints,
  type CoordKey,
} from '@core/schemas/hex-geometry';
import type { CameraState } from '@core/types/camera';

import { getTileColor, type ColorMode } from '../colors';
import {
  createHexPolygon,
  updateHexPolygonStyle,
  createSvgRoot,
  createGroup,
  applyCameraTransform,
  SVG_NS,
} from '../svg';

import {
  type TerrainRegistry,
  type HexCanvasConfig,
  DEFAULT_HEX_CANVAS_CONFIG,
  HEX_STYLES,
} from './types';

// ═══════════════════════════════════════════════════════════════
// Base Hex Canvas
// ═══════════════════════════════════════════════════════════════

export abstract class BaseHexCanvas {
  // ─────────────────────────────────────────────────────────────
  // Protected State (accessible by subclasses)
  // ─────────────────────────────────────────────────────────────

  protected readonly container: HTMLElement;
  protected readonly svg: SVGSVGElement;
  protected readonly tileGroup: SVGGElement;
  protected readonly overlayGroup: SVGGElement;
  protected readonly tileCache: Map<CoordKey, SVGPolygonElement> = new Map();

  protected hexSize: number;
  protected colorMode: ColorMode;
  protected terrainRegistry: TerrainRegistry = {};

  protected viewportWidth = 0;
  protected viewportHeight = 0;

  protected resizeObserver: ResizeObserver | null = null;

  // ─────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────

  constructor(container: HTMLElement, config: HexCanvasConfig = {}) {
    this.container = container;
    this.hexSize = config.hexSize ?? DEFAULT_HEX_CANVAS_CONFIG.hexSize;
    this.colorMode = config.colorMode ?? DEFAULT_HEX_CANVAS_CONFIG.colorMode;

    // Create SVG structure
    this.svg = createSvgRoot(100, 100);
    this.tileGroup = createGroup('tiles');
    this.overlayGroup = createGroup('overlay');

    // Append base groups - subclasses can add more layers between
    this.svg.appendChild(this.tileGroup);

    // Setup resize observer
    this.setupResizeObserver();
  }

  // ─────────────────────────────────────────────────────────────
  // Abstract Methods (subclasses must implement)
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all SVG groups that need camera transform applied.
   * Subclasses define their own layer structure.
   */
  protected abstract getTransformGroups(): SVGGElement[];

  /**
   * Called after SVG is created, before resize observer.
   * Subclasses can add additional layers here.
   */
  protected abstract setupLayers(): void;

  // ─────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────

  /**
   * Set color mode for tile rendering
   */
  setColorMode(mode: ColorMode): void {
    this.colorMode = mode;
  }

  /**
   * Set terrain registry for color lookup
   */
  setTerrainRegistry(registry: TerrainRegistry): void {
    this.terrainRegistry = registry;
  }

  /**
   * Set hex size
   */
  setHexSize(size: number): void {
    this.hexSize = size;
  }

  /**
   * Get current hex size
   */
  getHexSize(): number {
    return this.hexSize;
  }

  // ─────────────────────────────────────────────────────────────
  // Tile Rendering
  // ─────────────────────────────────────────────────────────────

  /**
   * Render all tiles (full redraw)
   */
  renderFull(map: HexMapData): void {
    // Clear existing tiles
    this.tileGroup.innerHTML = '';
    this.tileCache.clear();

    // Update hex size from map
    this.hexSize = map.metadata.hexSize ?? DEFAULT_HEX_CANVAS_CONFIG.hexSize;

    // Create polygons for each tile
    for (const [key, tile] of Object.entries(map.tiles) as [CoordKey, HexTileData][]) {
      const [q, r] = key.split(',').map(Number);
      const coord: HexCoordinate = { q, r };

      const color = getTileColor(tile, this.colorMode, this.terrainRegistry);

      const polygon = createHexPolygon(coord, this.hexSize, {
        fill: color,
        stroke: HEX_STYLES.DEFAULT_STROKE,
        strokeWidth: HEX_STYLES.DEFAULT_STROKE_WIDTH,
      });

      this.tileGroup.appendChild(polygon);
      this.tileCache.set(key, polygon);
    }
  }

  /**
   * Update specific tiles (after brush stroke or data change)
   */
  updateTiles(coords: CoordKey[], tiles: Record<CoordKey, HexTileData>): void {
    for (const key of coords) {
      const polygon = this.tileCache.get(key);
      const tile = tiles[key];

      if (polygon && tile) {
        const color = getTileColor(tile, this.colorMode, this.terrainRegistry);
        updateHexPolygonStyle(polygon, { fill: color });
      }
    }
  }

  /**
   * Update all tile colors (when color mode changes)
   */
  updateAllColors(tiles: Record<CoordKey, HexTileData>): void {
    for (const [key, polygon] of this.tileCache) {
      const tile = tiles[key];
      if (tile) {
        const color = getTileColor(tile, this.colorMode, this.terrainRegistry);
        updateHexPolygonStyle(polygon, { fill: color });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────

  /**
   * Apply camera transform to all layers
   */
  applyCamera(camera: CameraState): void {
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;

    for (const group of this.getTransformGroups()) {
      applyCameraTransform(group, camera.panX, camera.panY, camera.zoom, centerX, centerY);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Overlays
  // ─────────────────────────────────────────────────────────────

  /**
   * Show hover highlight on a hex
   */
  showHoverHighlight(coord: HexCoordinate): void {
    this.removeOverlayByClass('hover-highlight');

    const { x, y } = hexToPixel(coord, this.hexSize);
    const points = hexPolygonPoints(x, y, this.hexSize);

    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('fill', HEX_STYLES.HOVER_FILL);
    polygon.setAttribute('stroke', HEX_STYLES.HOVER_STROKE);
    polygon.setAttribute('stroke-width', HEX_STYLES.HOVER_STROKE_WIDTH.toString());
    polygon.classList.add('hover-highlight');

    this.overlayGroup.appendChild(polygon);
  }

  /**
   * Clear hover highlight
   */
  clearHoverHighlight(): void {
    this.removeOverlayByClass('hover-highlight');
  }

  /**
   * Clear all overlays
   */
  clearOverlay(): void {
    this.overlayGroup.innerHTML = '';
  }

  /**
   * Remove overlay elements by CSS class
   */
  protected removeOverlayByClass(className: string): void {
    const elements = this.overlayGroup.querySelectorAll(`.${className}`);
    elements.forEach((el) => el.remove());
  }

  /**
   * Create a hex polygon overlay at given center coordinates
   */
  protected createOverlayPolygon(
    cx: number,
    cy: number,
    style: { fill: string; stroke: string; strokeWidth: number; opacity?: number }
  ): SVGPolygonElement {
    const points = hexPolygonPoints(cx, cy, this.hexSize);
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('fill', style.fill);
    polygon.setAttribute('stroke', style.stroke);
    polygon.setAttribute('stroke-width', style.strokeWidth.toString());
    if (style.opacity !== undefined) {
      polygon.setAttribute('opacity', style.opacity.toString());
    }
    return polygon;
  }

  // ─────────────────────────────────────────────────────────────
  // Viewport
  // ─────────────────────────────────────────────────────────────

  /**
   * Get viewport dimensions
   */
  getViewportSize(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight };
  }

  /**
   * Get viewport center point
   */
  getViewportCenter(): { x: number; y: number } {
    return { x: this.viewportWidth / 2, y: this.viewportHeight / 2 };
  }

  /**
   * Get the SVG element (for event binding)
   */
  getSvgElement(): SVGSVGElement {
    return this.svg;
  }

  // ─────────────────────────────────────────────────────────────
  // Protected Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize SVG in container.
   * Called by subclasses after they set up their layers.
   */
  protected initializeSvg(): void {
    // Ensure overlay is always on top
    this.svg.appendChild(this.overlayGroup);
    this.container.appendChild(this.svg);
  }

  /**
   * Setup resize observer for viewport tracking
   */
  protected setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.viewportWidth = entry.contentRect.width;
        this.viewportHeight = entry.contentRect.height;

        this.svg.setAttribute('width', this.viewportWidth.toString());
        this.svg.setAttribute('height', this.viewportHeight.toString());
        this.svg.setAttribute('viewBox', `0 0 ${this.viewportWidth} ${this.viewportHeight}`);
      }
    });

    this.resizeObserver.observe(this.container);
  }

  // ─────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────

  /**
   * Dispose of the canvas and cleanup resources
   */
  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.svg.remove();
    this.tileCache.clear();
  }
}
