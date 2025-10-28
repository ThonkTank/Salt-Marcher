// src/services/state/store-manager.ts
// Central manager for coordinating multiple stores
// Provides unified interface for store registration and lifecycle management

import type {
    ReadableStore,
    PersistentStore,
    StoreManager,
} from "./store.interface";
import { logger } from "../../app/plugin-logger";

/**
 * Store registration entry
 */
interface StoreEntry {
    name: string;
    store: ReadableStore<any>;
    isPersistent: boolean;
}

/**
 * Implementation of the store manager
 */
export class StoreManagerImpl implements StoreManager {
    private stores = new Map<string, StoreEntry>();
    private disposed = false;

    /**
     * Register a store with the manager
     */
    register<T>(name: string, store: ReadableStore<T>): void {
        if (this.disposed) {
            throw new Error("StoreManager has been disposed");
        }

        if (this.stores.has(name)) {
            logger.warn(`[StoreManager] Store "${name}" already registered, replacing`);
        }

        const isPersistent = this.isPersistentStore(store);

        this.stores.set(name, {
            name,
            store,
            isPersistent,
        });

        logger.info(`[StoreManager] Registered store "${name}"${isPersistent ? " (persistent)" : ""}`);
    }

    /**
     * Get a registered store by name
     */
    get<T>(name: string): ReadableStore<T> | undefined {
        if (this.disposed) {
            throw new Error("StoreManager has been disposed");
        }

        return this.stores.get(name)?.store as ReadableStore<T> | undefined;
    }

    /**
     * List all registered store names
     */
    list(): string[] {
        if (this.disposed) {
            throw new Error("StoreManager has been disposed");
        }

        return Array.from(this.stores.keys());
    }

    /**
     * Save all persistent stores
     */
    async saveAll(): Promise<void> {
        if (this.disposed) {
            throw new Error("StoreManager has been disposed");
        }

        const persistentStores = Array.from(this.stores.values())
            .filter(entry => entry.isPersistent)
            .map(entry => ({
                name: entry.name,
                store: entry.store as PersistentStore<any>,
            }));

        if (persistentStores.length === 0) {
            logger.info("[StoreManager] No persistent stores to save");
            return;
        }

        logger.info(`[StoreManager] Saving ${persistentStores.length} persistent stores`);

        const savePromises = persistentStores.map(async ({ name, store }) => {
            try {
                await store.save();
                logger.debug(`[StoreManager] Saved store "${name}"`);
            } catch (error) {
                logger.error(`[StoreManager] Failed to save store "${name}":`, error);
                throw error;
            }
        });

        await Promise.all(savePromises);
        logger.info("[StoreManager] All persistent stores saved");
    }

    /**
     * Load all persistent stores
     */
    async loadAll(): Promise<void> {
        if (this.disposed) {
            throw new Error("StoreManager has been disposed");
        }

        const persistentStores = Array.from(this.stores.values())
            .filter(entry => entry.isPersistent)
            .map(entry => ({
                name: entry.name,
                store: entry.store as PersistentStore<any>,
            }));

        if (persistentStores.length === 0) {
            logger.info("[StoreManager] No persistent stores to load");
            return;
        }

        logger.info(`[StoreManager] Loading ${persistentStores.length} persistent stores`);

        const loadPromises = persistentStores.map(async ({ name, store }) => {
            try {
                await store.load();
                logger.debug(`[StoreManager] Loaded store "${name}"`);
            } catch (error) {
                logger.error(`[StoreManager] Failed to load store "${name}":`, error);
                // Don't throw - allow other stores to load
            }
        });

        await Promise.allSettled(loadPromises);
        logger.info("[StoreManager] Persistent stores loaded");
    }

    /**
     * Dispose of all stores and cleanup
     */
    dispose(): void {
        if (this.disposed) {
            return;
        }

        logger.info(`[StoreManager] Disposing ${this.stores.size} stores`);

        // Clear all stores
        this.stores.clear();
        this.disposed = true;

        logger.info("[StoreManager] Disposed");
    }

    /**
     * Check if disposed
     */
    isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Get store statistics
     */
    getStats(): {
        totalStores: number;
        persistentStores: number;
        nonPersistentStores: number;
    } {
        const persistentCount = Array.from(this.stores.values())
            .filter(entry => entry.isPersistent).length;

        return {
            totalStores: this.stores.size,
            persistentStores: persistentCount,
            nonPersistentStores: this.stores.size - persistentCount,
        };
    }

    /**
     * Check if a store is persistent
     */
    private isPersistentStore(store: ReadableStore<any>): boolean {
        return (
            "load" in store &&
            typeof (store as any).load === "function" &&
            "save" in store &&
            typeof (store as any).save === "function"
        );
    }
}

/**
 * Global store manager instance
 */
let globalStoreManager: StoreManagerImpl | null = null;

/**
 * Get or create the global store manager
 */
export function getStoreManager(): StoreManager {
    if (!globalStoreManager || globalStoreManager.isDisposed()) {
        globalStoreManager = new StoreManagerImpl();
    }
    return globalStoreManager;
}

/**
 * Reset the global store manager (mainly for testing)
 */
export function resetStoreManager(): void {
    if (globalStoreManager) {
        globalStoreManager.dispose();
        globalStoreManager = null;
    }
}