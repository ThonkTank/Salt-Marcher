// src/features/maps/state/terrain-feature-store.ts (refactored orchestrator)
//
// Terrain features store for map rendering
//
// Manages rivers, cliffs, roads, borders, and elevation lines that span multiple hexes.
// Features are stored as SVG-compatible paths and rendered as overlays on the map.
//
// Delegates to specialized modules:
// - terrain-feature-types.ts: Type definitions and interfaces
// - terrain-feature-persistence.ts: Load/save to disk
// - terrain-feature-renderer.ts: Rendering utilities and conversions

import type { App, TFile} from "obsidian";
import { normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { getStoreManager } from "@services/state/store-manager";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("terrain-feature-store");

// Re-export types for backward compatibility
export {
    type TerrainFeatureType,
    type TerrainFeaturePath,
    type TerrainFeatureStyle,
    type TerrainFeature,
    type TerrainFeatureState,
    type TerrainFeatureStore,
    DEFAULT_FEATURE_STYLES,
    generateFeatureId,
    isHexBased,
    isCornerBased,
    getPathCoordinates,
} from "./terrain-feature-types";

export {
    loadFeaturesFromDisk,
    saveFeaturesToDisk,
} from "./terrain-feature-persistence";

export {
    convertHexToCorner,
    validateFeatureForRendering,
    getRenderingHints,
    type FeatureRenderingHints,
} from "./terrain-feature-renderer";

// Import types and functions for store creation
import { loadFeaturesFromDisk, saveFeaturesToDisk } from "./terrain-feature-persistence";
import type {
    TerrainFeature,
    TerrainFeatureState,
    TerrainFeatureStore,
} from "./terrain-feature-types";

const featureRegistry = new WeakMap<App, Map<string, TerrainFeatureStore>>();

/**
 * Get or create terrain feature store for a map file
 */
export function getTerrainFeatureStore(
    app: App,
    mapFile: TFile
): TerrainFeatureStore {
    let storesByApp = featureRegistry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        featureRegistry.set(app, storesByApp);
    }

    const mapPath = normalizePath(mapFile.path);
    let store = storesByApp.get(mapPath);
    if (!store) {
        store = createTerrainFeatureStore(app, mapFile);
        storesByApp.set(mapPath, store);
    }

    return store;
}

/**
 * Create terrain feature store instance
 */
function createTerrainFeatureStore(
    app: App,
    mapFile: TFile
): TerrainFeatureStore {
    const mapPath = normalizePath(mapFile.path);
    const storeId = `terrain-features:${mapPath}`;

    // Get or register writable store
    const storeManager = getStoreManager();
    let state: WritableStore<TerrainFeatureState>;

    const existing = storeManager.get<TerrainFeatureState>(storeId);
    if (existing) {
        state = existing as WritableStore<TerrainFeatureState>;
    } else {
        const initialState: TerrainFeatureState = {
            mapPath,
            loaded: false,
            features: new Map(),
            version: 1,
        };
        state = writable(initialState);
        storeManager.register(storeId, state);
    }

    /**
     * Add a new terrain feature
     */
    const add = (feature: TerrainFeature): void => {
        state.update(s => {
            const newFeatures = new Map(s.features);
            newFeatures.set(feature.id, { ...feature });
            return {
                ...s,
                features: newFeatures,
                version: s.version + 1
            };
        });
    };

    /**
     * Update an existing terrain feature
     */
    const update = (id: string, updates: Partial<Omit<TerrainFeature, "id">>): boolean => {
        let updated = false;
        state.update(s => {
            const existing = s.features.get(id);
            if (existing) {
                const newFeatures = new Map(s.features);
                newFeatures.set(id, {
                    ...existing,
                    ...updates,
                    id, // Ensure id cannot be changed
                });
                updated = true;
                return {
                    ...s,
                    features: newFeatures,
                    version: s.version + 1
                };
            }
            return s;
        });
        return updated;
    };

    /**
     * Remove a terrain feature
     */
    const remove = (id: string): boolean => {
        let removed = false;
        state.update(s => {
            if (s.features.has(id)) {
                const newFeatures = new Map(s.features);
                newFeatures.delete(id);
                removed = true;
                return {
                    ...s,
                    features: newFeatures,
                    version: s.version + 1
                };
            }
            return s;
        });
        return removed;
    };

    /**
     * Get a terrain feature by ID
     */
    const get = (id: string): TerrainFeature | null => {
        let result: TerrainFeature | null = null;
        const unsubscribe = state.subscribe(s => {
            result = s.features.get(id) ?? null;
        });
        unsubscribe();
        return result;
    };

    /**
     * List all terrain features
     */
    const list = (): TerrainFeature[] => {
        let result: TerrainFeature[] = [];
        const unsubscribe = state.subscribe(s => {
            result = Array.from(s.features.values());
        });
        unsubscribe();
        return result;
    };

    /**
     * List terrain features by type
     */
    const listByType = (type: TerrainFeatureType): TerrainFeature[] => {
        let result: TerrainFeature[] = [];
        const unsubscribe = state.subscribe(s => {
            result = Array.from(s.features.values()).filter(f => f.type === type);
        });
        unsubscribe();
        return result;
    };

    /**
     * Clear all terrain features
     */
    const clear = (): void => {
        state.update(s => {
            return {
                ...s,
                features: new Map(),
                loaded: false,
                version: s.version + 1
            };
        });
    };

    /**
     * Load terrain features from disk
     *
     * Delegates to persistence module
     */
    const load = async (): Promise<void> => {
        try {
            const features = await loadFeaturesFromDisk(app, mapPath);
            state.update(s => ({
                ...s,
                features,
                loaded: true,
                version: s.version + 1
            }));
        } catch (error) {
            // Failed to load - log but continue
            logger.error("Failed to load features:", error);
            state.update(s => ({
                ...s,
                loaded: true
            }));
        }
    };

    /**
     * Save terrain features to disk
     *
     * Delegates to persistence module
     */
    const save = async (): Promise<void> => {
        const currentState = state.get();
        await saveFeaturesToDisk(app, mapPath, currentState.features);
    };

    return {
        state,
        add,
        update,
        remove,
        get,
        list,
        listByType,
        clear,
        load,
        save,
    };
}

