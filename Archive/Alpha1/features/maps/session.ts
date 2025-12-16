// src/features/maps/session.ts
// MapSession Pattern - Simple session factory replacing complex MapStoreRegistry
//
// Provides unified access to all map-related stores through a single session object.
// Sessions are cached by app+mapPath and disposed explicitly or on plugin unload.
//
// Benefits over MapStoreRegistry:
// - No reference counting (simpler lifecycle)
// - No LRU pool (explicit dispose only)
// - Clear get-or-create semantics
// - Single point of access for all map stores

import type { App, TFile } from "obsidian";
import { normalizePath } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { createTileCache, type TileCache } from "./data/tile-cache";
import { createFactionOverlayStore, type FactionOverlayStore } from "./state/faction-overlay-store";
import { createLocationMarkerStore, type LocationMarkerStore } from "./state/location-marker-store";
import { createLocationInfluenceStore, type LocationInfluenceStore } from "./state/location-influence-store";
import { getTerrainFeatureStore, type TerrainFeatureStore } from "./state/terrain-feature-store";
import { getWeatherOverlayStore, type WeatherOverlayStore } from "./state/weather-overlay-store";

const logger = configurableLogger.forModule("map-session");

/**
 * MapSession provides unified access to all stores for a single map.
 *
 * Usage:
 * ```typescript
 * const session = getMapSession(app, mapFile);
 * const tile = session.tileCache.get(coordToKey(coord));
 * session.dispose(); // When done with map
 * ```
 */
export interface MapSession {
    /** Normalized path of the map file */
    readonly mapPath: string;
    /** Reference to the map file */
    readonly mapFile: TFile;
    /** Tile data cache with debounced persistence */
    readonly tileCache: TileCache;
    /** Faction overlay assignments per hex */
    readonly factionOverlay: FactionOverlayStore;
    /** Location markers on the map */
    readonly locationMarkers: LocationMarkerStore;
    /** Location influence areas */
    readonly locationInfluence: LocationInfluenceStore;
    /** Terrain features (rivers, roads, etc.) */
    readonly terrainFeatures: TerrainFeatureStore;
    /** Weather overlay per hex */
    readonly weatherOverlay: WeatherOverlayStore;
    /** Dispose this session and all its stores */
    dispose(): void;
}

// Simple session cache - no LRU, no refCount
const sessions = new Map<string, MapSession>();

/**
 * Generate cache key from app and map file.
 * Supports multiple Obsidian app instances.
 */
function makeKey(app: App, mapFile: TFile): string {
    const appId = (app as any).appId ?? "app";
    return `${appId}:${normalizePath(mapFile.path)}`;
}

/**
 * Get or create a MapSession for the given map file.
 *
 * Sessions are cached and reused. Call disposeMapSession() when
 * the map is closed, or disposeAllSessions() on plugin unload.
 *
 * @param app - Obsidian App instance
 * @param mapFile - The map markdown file
 * @returns MapSession with all stores for this map
 */
export function getMapSession(app: App, mapFile: TFile): MapSession {
    const key = makeKey(app, mapFile);

    let session = sessions.get(key);
    if (session) {
        logger.debug(`Reusing session: ${mapFile.path}`);
        return session;
    }

    logger.info(`Creating session: ${mapFile.path}`);
    const mapPath = normalizePath(mapFile.path);

    // Create tile cache (core data store)
    const tileCache = createTileCache(app, mapFile);

    // Create overlay stores (use factory functions for isolation)
    const factionOverlay = createFactionOverlayStore(mapPath, {});
    const locationMarkers = createLocationMarkerStore(mapPath);
    const locationInfluence = createLocationInfluenceStore(mapPath, {});

    // Get singleton stores (these have their own registries)
    const terrainFeatures = getTerrainFeatureStore(app, mapFile);
    const weatherOverlay = getWeatherOverlayStore(app, mapFile);

    session = {
        mapPath,
        mapFile,
        tileCache,
        factionOverlay,
        locationMarkers,
        locationInfluence,
        terrainFeatures,
        weatherOverlay,
        dispose: () => disposeMapSession(app, mapFile),
    };

    sessions.set(key, session);
    logger.info(`Session created (total: ${sessions.size})`);
    return session;
}

/**
 * Dispose a single map session.
 * Cleans up all stores and removes from cache.
 *
 * @param app - Obsidian App instance
 * @param mapFile - The map file to dispose
 */
export function disposeMapSession(app: App, mapFile: TFile): void {
    const key = makeKey(app, mapFile);
    const session = sessions.get(key);
    if (!session) return;

    logger.info(`Disposing session: ${mapFile.path}`);

    // Cleanup stores
    session.tileCache.destroy();
    session.terrainFeatures.clear();
    session.weatherOverlay.clear();
    session.factionOverlay.clear();
    session.locationMarkers.clear();
    session.locationInfluence.clear();

    sessions.delete(key);
    logger.info(`Session disposed (remaining: ${sessions.size})`);
}

/**
 * Dispose all map sessions.
 * Called on plugin unload to cleanup all resources.
 */
export function disposeAllSessions(): void {
    logger.info(`Disposing all sessions (${sessions.size})`);

    for (const [key, session] of sessions) {
        try {
            session.tileCache.destroy();
            session.terrainFeatures.clear();
            session.weatherOverlay.clear();
            session.factionOverlay.clear();
            session.locationMarkers.clear();
            session.locationInfluence.clear();
        } catch (error) {
            logger.error(`Error disposing session ${key}:`, error);
        }
    }

    sessions.clear();
    logger.info("All sessions disposed");
}

/**
 * Check if a session exists for the given map.
 *
 * @param app - Obsidian App instance
 * @param mapFile - The map file to check
 * @returns true if session exists
 */
export function hasSession(app: App, mapFile: TFile): boolean {
    return sessions.has(makeKey(app, mapFile));
}

/**
 * Get the number of active sessions.
 * Useful for debugging and monitoring.
 */
export function getSessionCount(): number {
    return sessions.size;
}
