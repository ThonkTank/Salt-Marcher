// src/features/maps/state/global-store-manager.ts
// Manages stores that are shared across ALL maps (not tied to individual map lifecycle).
// These stores are only cleaned up on plugin unload, NOT when maps are deleted.

import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("global-store-manager");
import { getTerrainStore, resetTerrainStore, type TerrainStore } from "./terrain-store";

/**
 * Manages stores that are global (shared across all maps).
 * Lifecycle: Plugin load → unload (NOT tied to individual map deletion)
 *
 * NOTE: Region store has been removed - regions now use vault preset system directly.
 */
class GlobalStoreManagerImpl {
    private terrainStores = new WeakMap<App, TerrainStore>();

    /**
     * Get terrain store for app (shared across all maps).
     * Lifecycle: Plugin load → unload
     */
    getTerrainStore(app: App): TerrainStore {
        if (!this.terrainStores.has(app)) {
            logger.info("[GlobalStoreManager] Creating terrain store");
            const store = getTerrainStore(app);
            this.terrainStores.set(app, store);
        }
        return this.terrainStores.get(app)!;
    }

    /**
     * Release ALL global stores.
     * ONLY call this on plugin unload, NOT on individual map deletion!
     */
    releaseGlobalStores(app: App): void {
        logger.info("[GlobalStoreManager] Releasing all global stores");

        const terrainStore = this.terrainStores.get(app);
        if (terrainStore) {
            logger.info("[GlobalStoreManager] Resetting terrain store");
            resetTerrainStore(app);
            this.terrainStores.delete(app);
        }
    }
}

const singleton = new GlobalStoreManagerImpl();

export function getGlobalStoreManager(): GlobalStoreManagerImpl {
    return singleton;
}
