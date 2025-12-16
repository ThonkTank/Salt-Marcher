// src/features/maps/overlay/types.ts
// Generic overlay system types for hex map rendering
//
// Provides unified interface for registering and managing overlay layers
// with priority-based rendering and dynamic registration.

import type { WritableStore } from "@services/state";
import type { HexCoord } from "../rendering/rendering-types";


/**
 * Simplified overlay layer interface (v2)
 *
 * Provides better encapsulation than the legacy OverlayLayer interface by:
 * - Using subscribe() method instead of exposing internal state store
 * - Allowing layers to manage their own state without external WritableStore dependency
 * - Maintaining same rendering capabilities and lifecycle
 *
 * Each layer is responsible for:
 * - Managing its own internal state
 * - Converting state to render instructions
 * - Handling coordinate-based queries
 * - Notifying subscribers of state changes
 *
 * Layers are rendered in priority order (lower priority = rendered first = behind higher priority layers)
 *
 * @example
 * ```typescript
 * class MySimpleLayer implements SimpleOverlayLayer {
 *   readonly id = "my-layer";
 *   readonly name = "My Layer";
 *   readonly priority = 10;
 *
 *   private subscribers = new Set<() => void>();
 *   private data: Map<string, MyData> = new Map();
 *
 *   subscribe(callback: () => void): () => void {
 *     this.subscribers.add(callback);
 *     return () => this.subscribers.delete(callback);
 *   }
 *
 *   private notifySubscribers(): void {
 *     this.subscribers.forEach(cb => cb());
 *   }
 *
 *   getCoordinates(): readonly HexCoord[] {
 *     return Array.from(this.data.keys()).map(parseCoord);
 *   }
 *
 *   getRenderData(coord: HexCoord): OverlayRenderData | null {
 *     const entry = this.data.get(coordKey(coord));
 *     return entry ? { type: "fill", color: entry.color } : null;
 *   }
 *
 *   destroy(): void {
 *     this.subscribers.clear();
 *     this.data.clear();
 *   }
 * }
 * ```
 */
export interface SimpleOverlayLayer {
    /**
     * Unique identifier for this layer (e.g., "faction-overlay", "location-markers")
     */
    readonly id: string;

    /**
     * Display name for debugging/UI
     */
    readonly name: string;

    /**
     * Rendering priority (higher = rendered on top)
     *
     * Standard priorities:
     * - 0-9: Weather overlays, environmental effects
     * - 10-19: Location influence, region boundaries
     * - 20-29: Faction territories, political boundaries
     * - 30-39: Location markers, POIs
     * - 40+: Building indicators, UI overlays
     */
    readonly priority: number;

    /**
     * Get all coordinates that this layer should render on
     */
    getCoordinates(): readonly HexCoord[];

    /**
     * Get render data for a specific hex coordinate
     * Returns null if this layer has no data for this coordinate
     */
    getRenderData(coord: HexCoord): OverlayRenderData | null;

    /**
     * Subscribe to layer state changes
     *
     * The callback will be invoked whenever the layer's internal state changes
     * and a re-render is needed.
     *
     * @param callback - Function to call when layer state changes
     * @returns Unsubscribe function - call to stop listening to changes
     *
     * @example
     * ```typescript
     * const unsubscribe = layer.subscribe(() => {
     *   console.log("Layer changed, re-render needed");
     *   overlayManager.refresh();
     * });
     *
     * // Later, when cleanup is needed:
     * unsubscribe();
     * ```
     */
    subscribe(callback: () => void): () => void;

    /**
     * Optional whole-layer rendering
     *
     * For layers that render complex multi-coordinate SVG elements (like river paths, wind arrows),
     * implement this method instead of getRenderData(). The overlay manager will call
     * this once per render cycle instead of calling getRenderData() per coordinate.
     *
     * @param group - SVG group element for this layer
     * @param hexToPixel - Function to convert hex coordinates to pixel coordinates
     *
     * @example
     * ```typescript
     * renderWhole(group, hexToPixel) {
     *   group.innerHTML = ''; // Clear previous render
     *   for (const arrow of this.getArrows()) {
     *     const element = createArrowSVG(arrow, hexToPixel);
     *     group.appendChild(element);
     *   }
     * }
     * ```
     */
    renderWhole?(group: SVGGElement, hexToPixel: (coord: HexCoord) => { x: number; y: number }): void;

    /**
     * Cleanup resources (unsubscribe, remove DOM elements, clear internal state, etc.)
     */
    destroy(): void;
}

/**
 * Any overlay layer type
 *
 * Use this type when accepting any layer implementation in functions or interfaces.
 * All layers now implement SimpleOverlayLayer.
 */
export type AnyOverlayLayer = SimpleOverlayLayer;

/**
 * Render instructions for a single hex overlay
 *
 * Layers can provide different rendering modes:
 * - fill: SVG polygon fill (uses existing scene.setOverlay mechanism)
 * - svg: Custom SVG element to append to contentG
 */
export type OverlayRenderData =
    | OverlayRenderFill
    | OverlayRenderSVG;

/**
 * Fill-based overlay (uses existing scene.setOverlay mechanism)
 *
 * Renders by modifying the hex polygon's fill/stroke properties.
 * Efficient for simple color overlays.
 */
export interface OverlayRenderFill {
    type: "fill";
    color: string;
    fillOpacity?: string;
    strokeWidth?: string;
    strokeOpacity?: string;

    /**
     * Optional metadata for inspector/tooltips
     */
    metadata?: {
        label?: string;
        tooltip?: string;
        [key: string]: any;
    };
}

/**
 * SVG element overlay (for custom shapes like markers/indicators)
 *
 * Renders by creating custom SVG elements positioned at hex coordinates.
 * More flexible but slightly less performant than fill-based overlays.
 */
export interface OverlayRenderSVG {
    type: "svg";

    /**
     * Factory function to create SVG element
     * Called by OverlayManager when hex needs to be rendered
     */
    createElement: (coord: HexCoord) => SVGElement;

    /**
     * Optional update function for existing elements
     * If not provided, element is replaced on state change
     *
     * This is an optimization: update in-place instead of destroying/recreating
     */
    updateElement?: (element: SVGElement, coord: HexCoord) => void;

    /**
     * Optional metadata for inspector/tooltips
     */
    metadata?: {
        label?: string;
        tooltip?: string;
        [key: string]: any;
    };
}

/**
 * Configuration for OverlayManager
 */
export interface OverlayManagerConfig {
    /**
     * Parent SVG group for rendering overlays
     */
    contentG: SVGGElement;

    /**
     * Map file path (for store scoping)
     */
    mapPath: string;

    /**
     * Hex scene instance (for coordinate calculations and hex management)
     */
    scene: {
        ensurePolys(coords: readonly HexCoord[]): void;
        setFactionOverlay(
            coord: HexCoord,
            overlay: { color: string; factionId?: string; factionName?: string; fillOpacity?: string; strokeWidth?: string } | null
        ): void;
    };

    /**
     * Hex geometry parameters (for coordinate conversion)
     * Required for whole-layer rendering (e.g., river paths)
     */
    hexGeometry?: {
        radius: number;
        padding: number;
        base: HexCoord;
    };

    /**
     * Enable debug logging
     */
    debug?: boolean;

    /**
     * Enable initialization mode.
     * When true, layer subscriptions are collected but callbacks are paused.
     * Call endInitialization() to trigger a single batch render.
     */
    initializationMode?: boolean;
}

/**
 * Layer visibility and opacity configuration
 */
export interface LayerConfig {
    visible: boolean;
    opacity: number; // 0.0 to 1.0
}

/**
 * OverlayManager interface
 *
 * Manages registration and lifecycle of overlay layers.
 * Handles priority-based rendering and automatic cleanup.
 *
 * Accepts both legacy OverlayLayer and new SimpleOverlayLayer implementations.
 */
export interface OverlayManager {
    /**
     * Register a new overlay layer
     * Layers are rendered in priority order (higher = on top)
     *
     * Accepts both legacy OverlayLayer (with state property) and
     * new SimpleOverlayLayer (with subscribe method) implementations.
     *
     * If a layer with the same ID is already registered,
     * the old layer is unregistered first.
     */
    register(layer: AnyOverlayLayer): void;

    /**
     * Unregister an overlay layer by ID
     * Calls layer.destroy() and removes all associated DOM elements
     */
    unregister(layerId: string): void;

    /**
     * Get a registered layer by ID
     * Returns either legacy OverlayLayer or new SimpleOverlayLayer
     */
    getLayer(layerId: string): AnyOverlayLayer | undefined;

    /**
     * Get all registered layers sorted by priority (lowest to highest)
     * Returns mix of legacy OverlayLayer and new SimpleOverlayLayer instances
     */
    getLayers(): readonly AnyOverlayLayer[];

    /**
     * Force re-render all layers
     * Useful after bulk state changes or camera transformations
     */
    refresh(): void;

    /**
     * End initialization mode and trigger batch render.
     * Has no effect if initializationMode was not enabled.
     * Should be called after all layers are registered.
     */
    endInitialization(): void;

    /**
     * Set layer visibility and opacity configuration
     *
     * Updates layer config and triggers re-render if layer is registered.
     *
     * @param layerId - Layer ID to configure
     * @param visible - Whether layer should be rendered
     * @param opacity - Layer opacity (0.0 to 1.0)
     */
    setLayerConfig(layerId: string, visible: boolean, opacity: number): void;

    /**
     * Get layer visibility and opacity configuration
     *
     * Returns current config or default (visible: true, opacity: 1.0) if not set.
     */
    getLayerConfig(layerId: string): LayerConfig;

    /**
     * Cleanup all layers and resources
     */
    destroy(): void;
}
