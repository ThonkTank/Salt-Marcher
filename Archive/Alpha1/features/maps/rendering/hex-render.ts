// src/features/maps/rendering/hex-render.ts
import type { App, TFile } from "obsidian";
import { listTilesForMap } from "../data/tile-repository";
import { getMapSession } from "../session";
import type { TileCoord, TileData } from "../data/tile-repository";
import {
    createAllTerrainFeatureLayers,
    createBuildingIndicatorLayer,
    createClimateOverlayLayer,
    createFactionOverlayLayer,
    createLocationInfluenceLayer,
    createLocationMarkerLayer,
    createOverlayManager,
    createRainShadowOverlayLayer,
    createWeatherOverlayLayer,
} from "../overlay";
import { PerformanceTimer } from "@services/performance";
import { getFactionOverlayStore } from "../state/faction-overlay-store";
import { createCameraController } from "@services/hex-rendering";
import { createInteractionController } from "./interactions";
import { createHexScene } from "./scene";
import type { HexInteractionDelegate } from "./rendering-types";
import type { AxialCoord } from "@geometry";
import type { HexOptions } from "../config/options";

// Type alias for backward compatibility
type HexCoord = AxialCoord;
import type { FloraType, MoistureLevel, TerrainType } from "../config/terrain";
import type { FactionOverlayEntry } from "../state/faction-overlay-store";
import { coordsInRadius } from "@geometry";
import { configurableLogger } from "@services/logging/configurable-logger";
export type { HexInteractionDelegate, HexInteractionOutcome } from "./rendering-types";

const logger = configurableLogger.forModule("hex-renderer");

export type RenderHandles = {
    readonly svg: SVGSVGElement;
    readonly contentG: SVGGElement;
    readonly overlay: SVGRectElement;
    readonly polyByCoord: ReadonlyMap<string, SVGPolygonElement>;
    readonly base: HexCoord;
    readonly padding: number;
    /** Sets the terrain icon for a hex (icon-based terrain system) */
    setTerrainIcon(coord: HexCoord, terrain: TerrainType | undefined): void;
    /** Sets the flora icon for a hex (icon-based terrain system) */
    setFloraIcon(coord: HexCoord, flora: FloraType | undefined): void;
    /** Sets the background color for a hex (optional colored background) */
    setBackgroundColor(coord: HexCoord, color: string | undefined): void;
    /** Sets the moisture icon for a hex (icon-based moisture system) */
    setMoisture(coord: HexCoord, moisture: MoistureLevel | undefined): void;
    /** Controls visibility of icon layers (terrain, flora, or moisture) */
    setIconLayerVisibility(layer: 'terrain' | 'flora' | 'moisture', visible: boolean): void;
    /** Controls opacity of icon layers (terrain, flora, or moisture) */
    setIconLayerOpacity(layer: 'terrain' | 'flora' | 'moisture', opacity: number): void;
    /** Fügt fehlende Polygone für die angegebenen Koordinaten hinzu und erweitert das Overlay (viewBox nur initial). */
    ensurePolys(coords: readonly HexCoord[]): void;
    /** Ersetzt den aktiven Interaktions-Delegate (z. B. für Editor-Tools). */
    setInteractionDelegate(delegate: HexInteractionDelegate | null): void;
    /** Sets layer visibility and opacity (for Layer Controls Panel) */
    setLayerConfig(layerId: string, visible: boolean, opacity: number): void;
    /** Gets layer visibility and opacity configuration */
    getLayerConfig(layerId: string): { visible: boolean; opacity: number };
    destroy(): void;
};

const DEFAULT_PADDING = 12;
const CAMERA_OPTIONS = { minScale: 0.15, maxScale: 16, zoomSpeed: 1.01 } as const;
const DEFAULT_FALLBACK_RADIUS = 2;

type HexTileRecord = { coord: TileCoord; data: TileData };
type Bounds = { minR: number; maxR: number; minQ: number; maxQ: number };

/**
 * Compute bounding box for tiles.
 * Returns null if no tiles exist.
 */
function computeBounds(tiles: HexTileRecord[]): Bounds | null {
    if (!tiles.length) return null;
    let minR = Infinity;
    let maxR = -Infinity;
    let minQ = Infinity;
    let maxQ = -Infinity;
    for (const tile of tiles) {
        const { r, q } = tile.coord;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (q < minQ) minQ = q;
        if (q > maxQ) maxQ = q;
    }
    return { minR, maxR, minQ, maxQ };
}

/**
 * Build fallback coordinates using proper hexagonal shape.
 *
 * FIXED: Previously generated a square grid, now uses coordsInRadius
 * to generate proper hexagonal coordinates.
 */
function buildFallback(bounds: Bounds | null): HexCoord[] {
    // Determine center point for the hexagonal fallback
    const centerR = bounds ? Math.floor((bounds.minR + bounds.maxR) / 2) : 0;
    const centerQ = bounds ? Math.floor((bounds.minQ + bounds.maxQ) / 2) : 0;
    const center: HexCoord = { q: centerQ, r: centerR };

    // Generate proper hexagonal coordinates
    return coordsInRadius(center, DEFAULT_FALLBACK_RADIUS);
}

/**
 * Load tiles for a map and prepare initial render coordinates.
 *
 * Inlined from bootstrap.ts to eliminate circular dependencies and
 * fix the quadratic fallback bug.
 */
async function loadMapTiles(app: App, mapFile: TFile): Promise<{
    tiles: HexTileRecord[];
    base: HexCoord;
    initialCoords: HexCoord[];
}> {
    const mapPath = mapFile.path;
    logger.info(`Loading tiles for map: ${mapPath}`);

    try {
        const tiles = await listTilesForMap(app, mapFile);
        logger.info(`Loaded ${tiles.length} tiles for ${mapPath}`);

        const bounds = computeBounds(tiles);
        logger.info(`Tile bounds:`, bounds);

        const base: AxialCoord = {
            q: bounds ? bounds.minQ : 0,
            r: bounds ? bounds.minR : 0,
        };

        const initialCoords = tiles.length ? tiles.map((tile) => tile.coord) : buildFallback(bounds);

        return { tiles, base, initialCoords };
    } catch (error) {
        logger.error(`Error loading tiles for ${mapPath}:`, error);
        return {
            tiles: [],
            base: { q: 0, r: 0 },
            initialCoords: buildFallback(null)
        };
    }
}

export async function renderHexMap(
    app: App,
    host: HTMLElement,
    mapFile: TFile,
    opts: HexOptions
): Promise<RenderHandles> {
    const timer = new PerformanceTimer("render-full-map");
    const radius = opts.hexPixelSize as number;  // Cast branded type to number for rendering
    const padding = DEFAULT_PADDING;
    const mapPath = mapFile.path;

    const { tiles, base, initialCoords } = await loadMapTiles(app, mapFile);

    // Get session with tile store for variant-aware rendering
    // Note: We already have tiles from loadMapTiles(), so we hydrate instead of loading again
    const session = getMapSession(app, mapFile);
    const tileStore = session.tileStore;

    // Hydrate cache if not already loaded (avoids redundant disk I/O)
    const cache = session.tileCache;
    if (!cache.isLoaded()) {
        // Convert tiles to hydrate format
        const hydrateData = tiles.map(({ coord, data }) => ({ coord, data }));
        cache.hydrate(hydrateData);
    }

    const scene = createHexScene({
        host,
        radius,
        padding,
        base,
        initialCoords,
        tileStore, // Pass TileStore for variant support
    });

    const camera = createCameraController(
        scene.svg,
        scene.contentG,
        scene.overlay,
        host,
        { ...CAMERA_OPTIONS }
    );

    const interactions = createInteractionController({
        svg: scene.svg,
        overlay: scene.overlay,
        contentG: scene.contentG,
        base,
        radius,
        padding,
        host,
    });

    // Initialize icon-based terrain system (Phase 3: Icon-Based Terrain)
    for (const { coord, data } of tiles) {
        if (data.terrain) scene.setTerrainIcon(coord, data.terrain);
        if (data.flora) scene.setFloraIcon(coord, data.flora);
        if (data.backgroundColor) scene.setBackgroundColor(coord, data.backgroundColor);
    }

    // Subscribe to tile-store to reactively sync rendered hexes with data layer
    const tileStoreUnsubscribe = tileStore.state.subscribe((state) => {
        if (!state.loaded) return;

        // Get currently rendered hex coordinates
        const renderedKeys = new Set(scene.polyByCoord.keys());

        // Get tile coordinates from store (convert "r:c" format to "r,c" format)
        const storeKeys = new Set(
            Array.from(state.tiles.keys()).map(key => key.replace(":", ","))
        );

        // Remove hexes that no longer exist in the store
        for (const renderedKey of renderedKeys) {
            if (!storeKeys.has(renderedKey)) {
                const [q, r] = renderedKey.split(",").map(Number);
                scene.removeHex({ q, r });
            }
        }

        // Add new hexes from store (ensurePolys handles duplicates)
        const newCoords = Array.from(state.tiles.values()).map(record => record.coord);
        scene.ensurePolys(newCoords);
    });

    // Create overlay manager with all layers (Phase 14.3: Generic Overlay System)
    // Use initializationMode to batch all layer registrations (avoids 120+ re-renders)
    const overlayManager = createOverlayManager({
        contentG: scene.contentG,
        mapPath: mapFile.path,
        scene: {
            ensurePolys: (coords) => scene.ensurePolys(coords),
            setFactionOverlay: (coord, overlay) => scene.setFactionOverlay(coord, overlay),
        },
        hexGeometry: {
            radius,
            padding,
            base,
        },
        debug: false,
        initializationMode: true, // Batch layer registrations
    });

    // Register all overlay layers in priority order (lower priority = rendered first = behind)

    // Climate overlays (Priority 51-54: environmental base layers, composited together)
    overlayManager.register(createClimateOverlayLayer("temperature", app, mapFile));        // Red/Blue gradient
    overlayManager.register(createClimateOverlayLayer("precipitation", app, mapFile));      // Blue intensity
    overlayManager.register(createClimateOverlayLayer("cloudcover", app, mapFile));         // White/Gray
    overlayManager.register(createClimateOverlayLayer("wind", app, mapFile, radius, base, padding)); // Wind arrows

    // Rain shadow overlay (Priority 4: after climate base, before weather)
    overlayManager.register(createRainShadowOverlayLayer(app, mapFile, 270));   // Default: West wind

    // NOTE: Moisture visualization is now handled by icon system (scene.setMoistureIcon)
    // Moisture icons render automatically when TileData.moisture is set (see scene/scene.ts updateVisual)

    overlayManager.register(createWeatherOverlayLayer(app, mapFile, radius, base, padding)); // Priority 5

    // Register terrain feature layers (elevation-line: 6, river: 7, road: 8, cliff: 9, border: 10)
    const terrainFeatureLayers = createAllTerrainFeatureLayers(app, mapFile, radius, base, padding);
    terrainFeatureLayers.forEach(layer => overlayManager.register(layer));

    overlayManager.register(createLocationInfluenceLayer(app, mapFile)); // Priority 10
    overlayManager.register(createFactionOverlayLayer(app, mapFile)); // Priority 20
    overlayManager.register(createLocationMarkerLayer(app, mapFile, radius, base, padding)); // Priority 30
    overlayManager.register(createBuildingIndicatorLayer(app, mapFile, radius, base, padding)); // Priority 40

    // End initialization mode - renders all layers in a single batch
    overlayManager.endInitialization();

    // Faction legend (still uses direct store access for legend display)
    const legendHost = createLegendHost(host);
    const overlayStore = getFactionOverlayStore(app, mapFile);
    const updateLegendFromStore = () => {
        const entries = overlayStore.list();
        updateLegend(legendHost, entries);
    };
    const legendUnsubscribe = overlayStore.state.subscribe(updateLegendFromStore);
    updateLegendFromStore();

    const ensurePolys = (coords: readonly HexCoord[]) => {
        if (!coords.length) return;
        scene.ensurePolys(coords);
    };

    const cleanup = () => {
        overlayManager.destroy();
        tileStoreUnsubscribe();
        legendUnsubscribe();
        legendHost.remove();
        if (host.dataset.hexMapPositionChanged === "1") {
            host.style.position = host.dataset.hexMapPrevPosition ?? "";
        }
        delete host.dataset.hexMapPrevPosition;
        delete host.dataset.hexMapPositionChanged;
        host.classList.remove("sm-hex-map-host");
    };

    timer.end();

    return {
        svg: scene.svg,
        contentG: scene.contentG,
        overlay: scene.overlay,
        polyByCoord: scene.polyByCoord,
        base,
        padding,
        setTerrainIcon: (coord, terrain) => scene.setTerrainIcon(coord, terrain),
        setFloraIcon: (coord, flora) => scene.setFloraIcon(coord, flora),
        setBackgroundColor: (coord, color) => scene.setBackgroundColor(coord, color),
        setMoisture: (coord, moisture) => scene.setMoistureIcon(coord, moisture),
        setIconLayerVisibility: (layer, visible) => scene.setIconLayerVisibility(layer, visible),
        setIconLayerOpacity: (layer, opacity) => scene.setIconLayerOpacity(layer, opacity),
        ensurePolys,
        setInteractionDelegate: (delegate) => {
            interactions.setDelegate(delegate);
        },
        setHexClickCallback: (cb) => {
            interactions.setHexClickCallback(cb);
        },
        setLayerConfig: (layerId, visible, opacity) => {
            overlayManager.setLayerConfig(layerId, visible, opacity);
        },
        getLayerConfig: (layerId) => {
            return overlayManager.getLayerConfig(layerId);
        },
        destroy: () => {
            cleanup();
            interactions.destroy();
            camera.destroy();
            scene.destroy();
        },
    };
}

function createLegendHost(host: HTMLElement): HTMLElement {
    host.classList.add("sm-hex-map-host");
    if (getComputedStyle(host).position === "static") {
        (host.dataset.hexMapPrevPosition ??= host.style.position ?? "");
        host.dataset.hexMapPositionChanged = "1";
        host.style.position = "relative";
    } else {
        host.dataset.hexMapPositionChanged = "0";
    }
    const legend = host.ownerDocument.createElement("div");
    legend.className = "sm-map-legend is-empty";
    host.appendChild(legend);
    return legend;
}

function updateLegend(container: HTMLElement, entries: FactionOverlayEntry[]): void {
    container.empty();
    if (!entries.length) {
        container.classList.add("is-empty");
        return;
    }

    container.classList.remove("is-empty");

    const aggregate = new Map<string, { id: string; name: string; color: string; count: number }>();
    for (const entry of entries) {
        const id = entry.factionId;
        const name = entry.factionName && entry.factionName.trim().length > 0 ? entry.factionName : id;
        const color = entry.color;
        const current = aggregate.get(id);
        if (current) {
            current.count += 1;
        } else {
            aggregate.set(id, { id, name, color, count: 1 });
        }
    }

    const items = Array.from(aggregate.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
    });

    for (const item of items) {
        const row = container.createDiv({ cls: "sm-map-legend__item" });
        row.createDiv({ cls: "sm-map-legend__swatch" }).style.backgroundColor = item.color;
        row.createDiv({ cls: "sm-map-legend__label", text: item.name });
        row.createDiv({ cls: "sm-map-legend__meta", text: `${item.count}` });
    }
}
