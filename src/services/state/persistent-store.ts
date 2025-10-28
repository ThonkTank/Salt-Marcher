// src/services/state/persistent-store.ts
// Persistent store implementation with Obsidian vault storage
// Extends writable store with load/save capabilities

import type {
    PersistentStore,
    VersionedStore,
    StoreOptions,
    StoreMetadata,
    Updater,
} from "./store.interface";
import { writable } from "./writable-store";
import { App, normalizePath } from "obsidian";
import { logger } from "../../app/plugin-logger";

export interface PersistentStoreOptions<T> extends StoreOptions {
    /**
     * Obsidian app instance
     */
    app: App;

    /**
     * File path for storage (relative to vault root)
     */
    filePath: string;

    /**
     * Schema version for migrations
     */
    version?: number;

    /**
     * Migration function for version upgrades
     */
    migrate?: (data: unknown, fromVersion: number) => T;

    /**
     * Custom serializer (default: JSON.stringify)
     */
    serialize?: (value: T) => string;

    /**
     * Custom deserializer (default: JSON.parse)
     */
    deserialize?: (text: string) => unknown;

    /**
     * Auto-save on every change (default: false)
     */
    autoSave?: boolean;

    /**
     * Debounce delay for auto-save in ms (default: 1000)
     */
    autoSaveDelay?: number;
}

interface StoredData<T> {
    version: number;
    type: string;
    lastModified: string;
    data: T;
}

/**
 * Creates a persistent store backed by Obsidian vault storage
 */
export function persistent<T>(
    initialValue: T,
    options: PersistentStoreOptions<T>
): PersistentStore<T> {
    const {
        app,
        filePath,
        version = 1,
        migrate,
        serialize = JSON.stringify,
        deserialize = JSON.parse,
        autoSave = false,
        autoSaveDelay = 1000,
        name = `persistent-${filePath}`,
        ...storeOptions
    } = options;

    const normalizedPath = normalizePath(filePath);
    let isDirty = false;
    let saveTimeout: NodeJS.Timeout | null = null;

    // Create base writable store
    const store = writable(initialValue, { ...storeOptions, name });

    // Override set to track dirty state
    const originalSet = store.set;
    const originalUpdate = store.update;

    const markDirty = () => {
        isDirty = true;
        if (autoSave) {
            scheduleSave();
        }
    };

    const scheduleSave = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            save().catch(error => {
                logger.error(`[PersistentStore:${name}] Auto-save error:`, error);
            });
        }, autoSaveDelay);
    };

    const set = (value: T): void => {
        originalSet(value);
        markDirty();
    };

    const update = (updater: Updater<T>): void => {
        originalUpdate(updater);
        markDirty();
    };

    const load = async (): Promise<void> => {
        try {
            const file = app.vault.getAbstractFileByPath(normalizedPath);

            if (!file || !("path" in file)) {
                logger.info(`[PersistentStore:${name}] File not found, using initial value`);
                isDirty = false;
                return;
            }

            const content = await app.vault.read(file);
            const parsed = deserialize(content);

            // Handle versioned data
            if (isStoredData(parsed)) {
                const storedData = parsed as StoredData<unknown>;
                let data = storedData.data;

                // Apply migration if needed
                if (storedData.version < version && migrate) {
                    logger.info(
                        `[PersistentStore:${name}] Migrating from v${storedData.version} to v${version}`
                    );
                    data = migrate(data, storedData.version);
                }

                originalSet(data as T);
            } else {
                // Handle legacy unversioned data
                logger.warn(
                    `[PersistentStore:${name}] Loading unversioned data, assuming v1`
                );
                let data = parsed;

                if (migrate && version > 1) {
                    data = migrate(data, 1);
                }

                originalSet(data as T);
            }

            isDirty = false;
            logger.info(`[PersistentStore:${name}] Loaded from ${normalizedPath}`);
        } catch (error) {
            logger.error(`[PersistentStore:${name}] Load error:`, error);
            throw error;
        }
    };

    const save = async (): Promise<void> => {
        try {
            const value = store.get();
            const storedData: StoredData<T> = {
                version,
                type: name,
                lastModified: new Date().toISOString(),
                data: value,
            };

            const content = serialize(storedData);

            // Ensure directory exists
            const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
            if (dir) {
                const folder = app.vault.getAbstractFileByPath(dir);
                if (!folder) {
                    await app.vault.createFolder(dir);
                }
            }

            // Write or create file
            const file = app.vault.getAbstractFileByPath(normalizedPath);
            if (file && "path" in file) {
                await app.vault.modify(file, content);
            } else {
                await app.vault.create(normalizedPath, content);
            }

            isDirty = false;
            logger.info(`[PersistentStore:${name}] Saved to ${normalizedPath}`);
        } catch (error) {
            logger.error(`[PersistentStore:${name}] Save error:`, error);
            throw error;
        }
    };

    const getStorageKey = (): string => {
        return normalizedPath;
    };

    const isStoredData = (data: unknown): boolean => {
        if (!data || typeof data !== "object") return false;
        const obj = data as any;
        return (
            typeof obj.version === "number" &&
            typeof obj.type === "string" &&
            typeof obj.lastModified === "string" &&
            "data" in obj
        );
    };

    return {
        subscribe: store.subscribe,
        get: store.get,
        set,
        update,
        load,
        save,
        isDirty: () => isDirty,
        getStorageKey,
    };
}

/**
 * Creates a versioned persistent store with migration support
 */
export function versionedPersistent<T>(
    initialValue: T,
    options: PersistentStoreOptions<T> & { version: number }
): VersionedStore<T> {
    const store = persistent(initialValue, options);
    const { version, name = "versioned-store" } = options;

    const getMetadata = (): StoreMetadata => {
        return {
            version,
            type: name,
            lastModified: new Date().toISOString(),
        };
    };

    const migrate = (data: unknown, fromVersion: number): T => {
        if (options.migrate) {
            return options.migrate(data, fromVersion);
        }

        logger.warn(
            `[VersionedStore:${name}] No migration function provided for v${fromVersion} to v${version}`
        );
        return data as T;
    };

    return {
        ...store,
        getMetadata,
        migrate,
    };
}