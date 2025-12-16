// src/features/maps/overlay/overlay-manager.ts
// Generic overlay manager for hex map rendering
//
// Manages registration, lifecycle, and rendering of overlay layers.
// Handles priority-based z-ordering and automatic cleanup.

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("overlay-manager");
import { coordToKey, axialToCanvasPixel } from "@geometry";
import { PerformanceTimer } from "@services/performance";
import type {
    OverlayManager,
    OverlayManagerConfig,
    OverlayRenderFill,
    OverlayRenderSVG,
    AnyOverlayLayer,
} from "./overlay-types";
import type { HexCoord } from "../rendering/rendering-types";

/**
 * Layer visibility and opacity configuration
 */
export interface LayerConfig {
    visible: boolean;
    opacity: number; // 0.0 to 1.0
}

/**
 * Create hex-to-pixel conversion function
 *
 * Converts hex coordinates (Axial system) to pixel coordinates for SVG rendering.
 *
 * @param hexGeometry - Hex geometry parameters (radius, padding, base)
 * @returns Function that converts hex coord to pixel position
 */
function createHexToPixelFunction(
    hexGeometry?: { radius: number; padding: number; base: HexCoord }
): (coord: HexCoord) => { x: number; y: number } {
    // If no geometry provided, use simple fallback
    if (!hexGeometry) {
        return (coord: HexCoord) => ({ x: coord.q * 50, y: coord.r * 50 });
    }

    const { radius, padding, base } = hexGeometry;

    return (coord: HexCoord): { x: number; y: number } => {
        return axialToCanvasPixel(coord, radius, base, padding);
    };
}

/**
 * Create overlay manager instance
 *
 * Manages lifecycle and rendering of overlay layers with priority-based z-ordering.
 *
 * @example
 * ```typescript
 * const manager = createOverlayManager({
 *     contentG: scene.contentG,
 *     mapPath: mapFile.path,
 *     scene,
 * });
 *
 * // Register layers
 * manager.register(createFactionOverlayLayer(app, mapFile));
 * manager.register(createLocationMarkerLayer(app, mapFile, radius, base, padding));
 *
 * // Cleanup
 * manager.destroy();
 * ```
 */
export function createOverlayManager(config: OverlayManagerConfig): OverlayManager {
    const { contentG, mapPath, scene, debug = false, hexGeometry, initializationMode = false } = config;

    // Registry of layers by ID
    const layers = new Map<string, AnyOverlayLayer>();

    // Subscription cleanup functions by layer ID
    const unsubscribes = new Map<string, () => void>();

    // SVG group for each layer (for z-index management)
    const layerGroups = new Map<string, SVGGElement>();

    // SVG elements by coordinate and layer
    // Map<layerId, Map<coordKey, SVGElement>>
    const svgElements = new Map<string, Map<string, SVGElement>>();

    // Track fill-based overlay coordinates separately
    // Fill-based overlays (elevation, moisture) don't create SVG elements,
    // they modify polygon styles directly via scene.setFactionOverlay().
    // We need to track which coordinates have been filled so we can clear them later.
    // Map<layerId, Set<coordKey>>
    const fillCoordinates = new Map<string, Set<string>>();

    // Layer visibility and opacity configuration
    // Default: all layers visible with full opacity
    const layerConfigs = new Map<string, LayerConfig>();

    // Initialization mode state
    let isInitializing = initializationMode;
    const pendingInitLayers = new Set<string>();

    const SVG_NS = "http://www.w3.org/2000/svg";

    /**
     * Get or create SVG group for a layer
     */
    const getLayerGroup = (layerId: string): SVGGElement => {
        let group = layerGroups.get(layerId);
        if (!group) {
            group = document.createElementNS(SVG_NS, "g");
            group.setAttribute("class", `overlay-layer overlay-layer--${layerId}`);
            group.setAttribute("data-layer-id", layerId);
            contentG.appendChild(group);
            layerGroups.set(layerId, group);
        }
        return group;
    };

    /**
     * Update layer group opacity from config
     */
    const updateLayerGroupOpacity = (layerId: string) => {
        const group = layerGroups.get(layerId);
        if (!group) return;

        const config = layerConfigs.get(layerId) ?? { visible: true, opacity: 1.0 };
        group.setAttribute("opacity", String(config.opacity));
    };

    /**
     * Re-order layer groups by priority
     *
     * SVG elements are rendered in DOM order, so we re-append groups
     * in priority order to ensure correct z-index.
     */
    const reorderLayers = () => {
        const sorted = Array.from(layers.values())
            .sort((a, b) => a.priority - b.priority); // Lower priority first (bottom)

        for (const layer of sorted) {
            const group = layerGroups.get(layer.id);
            if (group) {
                // Re-append to move to correct z-index
                contentG.appendChild(group);
            }
        }
    };

    /**
     * Render a fill-based overlay
     *
     * Uses scene.setFactionOverlay to modify hex polygon appearance.
     * Applies layer opacity configuration if set.
     */
    const renderFill = (layerId: string, coord: HexCoord, data: OverlayRenderFill) => {
        // Get layer config (default to visible with full opacity)
        const config = layerConfigs.get(layerId) ?? { visible: true, opacity: 1.0 };

        // Apply opacity multiplier from layer config
        let fillOpacity = data.fillOpacity ?? "1.0";
        if (config.opacity < 1.0) {
            const baseOpacity = parseFloat(fillOpacity);
            fillOpacity = String(baseOpacity * config.opacity);
        }

        scene.setFactionOverlay(coord, {
            color: data.color,
            fillOpacity,
            strokeWidth: data.strokeWidth,
            factionId: data.metadata?.label,
            factionName: data.metadata?.tooltip,
        });

        // Track fill coordinate for later cleanup
        const key = coordToKey(coord);
        let fillCoords = fillCoordinates.get(layerId);
        if (!fillCoords) {
            fillCoords = new Set();
            fillCoordinates.set(layerId, fillCoords);
        }
        fillCoords.add(key);
    };

    /**
     * Render an SVG-based overlay
     *
     * Creates or updates custom SVG element positioned at hex coordinate.
     */
    const renderSVG = (layerId: string, coord: HexCoord, data: OverlayRenderSVG) => {
        const group = getLayerGroup(layerId);
        const key = coordToKey(coord);

        let elementsMap = svgElements.get(layerId);
        if (!elementsMap) {
            elementsMap = new Map();
            svgElements.set(layerId, elementsMap);
        }

        let element = elementsMap.get(key);

        if (element && data.updateElement) {
            // Update existing element in-place
            data.updateElement(element, coord);
        } else {
            // Create new element (or replace if no update function)
            if (element) {
                element.remove();
            }
            element = data.createElement(coord);
            element.setAttribute("data-coord", key);
            group.appendChild(element);
            elementsMap.set(key, element);
        }
    };

    /**
     * Clear render data for a coordinate
     *
     * SIMPLIFIED: Just clear, no re-render logic
     */
    const clearRender = (layerId: string, coord: HexCoord) => {
        const key = coordToKey(coord);

        // Clear SVG elements
        const elementsMap = svgElements.get(layerId);
        if (elementsMap) {
            const element = elementsMap.get(key);
            if (element) {
                element.remove();
                elementsMap.delete(key);
            }
        }

        // Clear fill coordinates tracking
        const fillCoords = fillCoordinates.get(layerId);
        if (fillCoords) {
            fillCoords.delete(key);
        }

        // Clear fill overlay (set to null)
        scene.setFactionOverlay(coord, null);
    };

    /**
     * Render a single layer
     *
     * SIMPLIFIED: Renders all coordinates, no culling
     * Respects layer visibility and opacity configuration.
     */
    const renderLayer = (layer: AnyOverlayLayer) => {
        const timer = new PerformanceTimer(`overlay-render-${layer.id}`);

        // Get layer config (default to visible with full opacity)
        const config = layerConfigs.get(layer.id) ?? { visible: true, opacity: 1.0 };

        // DEBUG: Log render attempt
        if (debug) {
            logger.debug(`renderLayer called`, {
                layerId: layer.id,
                config,
                hasLayerConfig: layerConfigs.has(layer.id)
            });
        }

        // If layer is not visible, clear all coordinates and skip rendering
        if (!config.visible) {
            // Clear whole-layer rendering (if applicable)
            if (layer.renderWhole) {
                const group = layerGroups.get(layer.id);
                if (group) {
                    group.innerHTML = ''; // Clear all content
                }
            }

            // Clear all existing SVG elements
            const elementsMap = svgElements.get(layer.id);
            if (elementsMap) {
                for (const [key] of elementsMap) {
                    const [q, r] = key.split(",").map(Number);
                    clearRender(layer.id, { q, r });
                }
            }

            // Clear all existing fill coordinates
            const fillCoords = fillCoordinates.get(layer.id);
            if (fillCoords) {
                for (const key of fillCoords) {
                    const [q, r] = key.split(",").map(Number);
                    clearRender(layer.id, { q, r });
                }
            }

            timer.end();
            return;
        }

        const coords = layer.getCoordinates();
        const coordKeys = new Set(coords.map(coordToKey));

        // DEBUG: Log coordinate count
        if (debug) {
            logger.debug(`getCoordinates result`, {
                layerId: layer.id,
                coordCount: coords.length,
                firstCoords: coords.slice(0, 3)
            });
        }

        // Ensure polygons exist for all coordinates
        scene.ensurePolys(coords);

        // Whole-layer rendering (for complex multi-coordinate elements like river paths)
        if (layer.renderWhole) {
            const group = getLayerGroup(layer.id);

            // Create hex-to-pixel conversion function
            const hexToPixel = createHexToPixelFunction(hexGeometry);

            layer.renderWhole(group, hexToPixel);
            updateLayerGroupOpacity(layer.id);
            timer.end();
            return;
        }

        // Per-coordinate rendering (standard approach)
        for (const coord of coords) {
            const data = layer.getRenderData(coord);
            if (!data) continue;

            if (data.type === "fill") {
                renderFill(layer.id, coord, data);
            } else if (data.type === "svg") {
                renderSVG(layer.id, coord, data);
            }
        }

        // Update SVG layer group opacity (for SVG-based overlays)
        updateLayerGroupOpacity(layer.id);

        // Clear coordinates that are no longer present (SVG elements)
        const elementsMap = svgElements.get(layer.id);
        if (elementsMap) {
            const toRemove: string[] = [];
            for (const [key] of elementsMap) {
                if (!coordKeys.has(key)) {
                    toRemove.push(key);
                }
            }
            for (const key of toRemove) {
                const [q, r] = key.split(",").map(Number);
                clearRender(layer.id, { q, r });
            }
        }

        // Clear fill coordinates that are no longer present
        const fillCoords = fillCoordinates.get(layer.id);
        if (fillCoords) {
            const toRemove: string[] = [];
            for (const key of fillCoords) {
                if (!coordKeys.has(key)) {
                    toRemove.push(key);
                }
            }
            for (const key of toRemove) {
                const [q, r] = key.split(",").map(Number);
                clearRender(layer.id, { q, r });
            }
        }

        timer.end();
    };

    /**
     * Subscribe to layer state changes
     *
     * SIMPLIFIED: Direct re-render, no scheduler
     */
    const subscribeLayer = (layer: AnyOverlayLayer) => {
        const unsubscribe = layer.subscribe(() => {
            if (isInitializing) {
                // Queue layer for batch render after initialization
                pendingInitLayers.add(layer.id);
                return;
            }
            renderLayer(layer);
        });
        unsubscribes.set(layer.id, unsubscribe);
    };

    /**
     * Register a new overlay layer
     *
     * If a layer with the same ID already exists, unregisters it first.
     */
    const register = (layer: AnyOverlayLayer) => {
        if (layers.has(layer.id)) {
            logger.warn(`Layer ${layer.id} already registered, unregistering old instance`);
            unregister(layer.id);
        }

        if (debug) {
            logger.info(`Registering overlay layer: ${layer.id} (priority: ${layer.priority})`);
        }

        layers.set(layer.id, layer);
        subscribeLayer(layer);
        if (isInitializing) {
            // Queue for batch render after initialization
            pendingInitLayers.add(layer.id);
        } else {
            renderLayer(layer);
        }
        reorderLayers();
    };

    /**
     * Unregister an overlay layer
     *
     * Calls layer.destroy() and removes all associated resources.
     */
    const unregister = (layerId: string) => {
        const layer = layers.get(layerId);
        if (!layer) return;

        if (debug) {
            logger.info(`Unregistering overlay layer: ${layerId}`);
        }

        // Cleanup subscription
        const unsubscribe = unsubscribes.get(layerId);
        if (unsubscribe) {
            unsubscribe();
            unsubscribes.delete(layerId);
        }

        // Cleanup SVG elements
        const elementsMap = svgElements.get(layerId);
        if (elementsMap) {
            for (const element of elementsMap.values()) {
                element.remove();
            }
            svgElements.delete(layerId);
        }

        // Cleanup fill coordinates tracking
        fillCoordinates.delete(layerId);

        // Cleanup layer group
        const group = layerGroups.get(layerId);
        if (group) {
            group.remove();
            layerGroups.delete(layerId);
        }

        // Call layer's destroy
        layer.destroy();

        layers.delete(layerId);
    };

    /**
     * Get a registered layer by ID
     */
    const getLayer = (layerId: string): AnyOverlayLayer | undefined => {
        return layers.get(layerId);
    };

    /**
     * Get all registered layers sorted by priority (lowest to highest)
     */
    const getLayers = (): readonly AnyOverlayLayer[] => {
        return Array.from(layers.values())
            .sort((a, b) => a.priority - b.priority);
    };

    /**
     * Force re-render all layers
     *
     * Useful after bulk state changes or camera transformations.
     */
    const refresh = () => {
        for (const layer of layers.values()) {
            renderLayer(layer);
        }
        reorderLayers();
    };

    /**
     * End initialization mode and trigger batch render of all pending layers.
     *
     * During initialization mode, layer subscriptions and register() calls
     * queue layers instead of rendering immediately. This allows bulk
     * registration without triggering 120+ re-renders.
     *
     * After calling this:
     * - All pending layers are rendered once
     * - Future subscription callbacks render immediately (normal mode)
     */
    const endInitialization = () => {
        if (!isInitializing) {
            return; // Already in normal mode
        }

        logger.debug(`Ending initialization, rendering ${pendingInitLayers.size} pending layers`);

        isInitializing = false;

        // Render all pending layers once
        for (const layerId of pendingInitLayers) {
            const layer = layers.get(layerId);
            if (layer) {
                renderLayer(layer);
            }
        }
        pendingInitLayers.clear();

        // Ensure proper z-ordering
        reorderLayers();

        logger.debug(`Initialization complete`);
    };

    /**
     * Set layer visibility and opacity configuration
     *
     * Updates layer config and triggers re-render if layer is registered.
     * Config persists until explicitly changed or layer is unregistered.
     *
     * @param layerId - Layer ID to configure
     * @param visible - Whether layer should be rendered
     * @param opacity - Layer opacity (0.0 to 1.0)
     */
    const setLayerConfig = (layerId: string, visible: boolean, opacity: number) => {
        // Clamp opacity to valid range
        opacity = Math.max(0.0, Math.min(1.0, opacity));

        layerConfigs.set(layerId, { visible, opacity });

        // Re-render layer if it's registered
        const layer = layers.get(layerId);
        if (layer) {
            renderLayer(layer);
        }
    };

    /**
     * Get layer visibility and opacity configuration
     *
     * Returns current config or default (visible: true, opacity: 1.0) if not set.
     *
     * @param layerId - Layer ID to query
     */
    const getLayerConfig = (layerId: string): LayerConfig => {
        return layerConfigs.get(layerId) ?? { visible: true, opacity: 1.0 };
    };

    /**
     * Cleanup all layers and resources
     */
    const destroy = () => {
        for (const layerId of Array.from(layers.keys())) {
            unregister(layerId);
        }
        layers.clear();
        unsubscribes.clear();
        svgElements.clear();
        fillCoordinates.clear();
        layerGroups.clear();
        layerConfigs.clear();
    };

    return {
        register,
        unregister,
        getLayer,
        getLayers,
        refresh,
        endInitialization,
        destroy,
        setLayerConfig,
        getLayerConfig,
    };
}
