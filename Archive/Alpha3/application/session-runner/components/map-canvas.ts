/**
 * Map Canvas Component (SessionRunner)
 *
 * Extends BaseHexCanvas with display-specific features:
 * - Route layer for travel path rendering
 * - Token layer for party token
 *
 * For map display in SessionRunner workmode.
 */

import { BaseHexCanvas, type HexCanvasConfig, createGroup } from '@shared/map';

// ═══════════════════════════════════════════════════════════════
// Re-export config type for consumers
// ═══════════════════════════════════════════════════════════════

export type { HexCanvasConfig as MapCanvasConfig };

// ═══════════════════════════════════════════════════════════════
// Map Canvas (SessionRunner)
// ═══════════════════════════════════════════════════════════════

export class MapCanvas extends BaseHexCanvas {
  // Additional layers for SessionRunner
  private readonly routeGroup: SVGGElement;
  private readonly tokenGroup: SVGGElement;

  constructor(container: HTMLElement, config: HexCanvasConfig = {}) {
    super(container, config);

    // Create additional layers
    this.routeGroup = createGroup('route');
    this.tokenGroup = createGroup('token');

    this.setupLayers();
    this.initializeSvg();
  }

  // ─────────────────────────────────────────────────────────────
  // BaseHexCanvas Abstract Implementation
  // ─────────────────────────────────────────────────────────────

  protected setupLayers(): void {
    // SessionRunner uses 4-layer structure:
    // tiles (from base) → route → token → overlay (from base)
    this.svg.appendChild(this.routeGroup);
    this.svg.appendChild(this.tokenGroup);
  }

  protected getTransformGroups(): SVGGElement[] {
    // All 4 layers need camera transform
    return [this.tileGroup, this.routeGroup, this.tokenGroup, this.overlayGroup];
  }

  // ─────────────────────────────────────────────────────────────
  // SessionRunner-Specific: Layer Accessors
  // ─────────────────────────────────────────────────────────────

  /**
   * Get route layer for RouteOverlay component
   */
  getRouteGroup(): SVGGElement {
    return this.routeGroup;
  }

  /**
   * Get token layer for PartyToken component
   */
  getTokenGroup(): SVGGElement {
    return this.tokenGroup;
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new map canvas for SessionRunner
 */
export function createMapCanvas(container: HTMLElement, config?: HexCanvasConfig): MapCanvas {
  return new MapCanvas(container, config);
}
