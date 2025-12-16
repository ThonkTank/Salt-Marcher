// src/services/state/persistent-store.ts
// Persistent store implementation with Obsidian vault storage
// Extends writable store with load/save capabilities

import type { App} from "obsidian";
import { normalizePath } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('state-persistent-store');
import { writable } from "./writable-store";
import type {
    PersistentStore,
    VersionedStore,
    StoreOptions,
    StoreMetadata,
    Updater,
} from "./store.interface";

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
                logger.error(`Auto-save error:`, error);
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
                logger.info(`File not found, using initial value`);
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
                        `Migrating from v${storedData.version} to v${version}`
                    );
                    data = migrate(data, storedData.version);
                }

                originalSet(data as T);
            } else {
                // Handle legacy unversioned data
                logger.warn(
                    `Loading unversioned data, assuming v1`
                );
                let data = parsed;

                if (migrate && version > 1) {
                    data = migrate(data, 1);
                }

                originalSet(data as T);
            }

            isDirty = false;
            logger.info(`Loaded from ${normalizedPath}`);
        } catch (error) {
            logger.error(`Load error:`, error);
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
                    try {
                        await app.vault.createFolder(dir);
                    } catch (error) {
                        // Ignore "Folder already exists" error (race condition from parallel saves)
                        if (!(error instanceof Error && error.message === "Folder already exists.")) {
                            throw error;
                        }
                    }
                }
            }

            // Write or create file
            const file = app.vault.getAbstractFileByPath(normalizedPath);
            if (file && "path" in file) {
                await app.vault.modify(file, content);
            } else {
                try {
                    await app.vault.create(normalizedPath, content);
                } catch (error) {
                    // Handle race condition: file was created between check and create
                    if (error instanceof Error && error.message === "File already exists.") {
                        logger.warn(`File created during save, using adapter.write`);
                        // Use direct adapter write which doesn't fail on existing files
                        await app.vault.adapter.write(normalizedPath, content);
                    } else {
                        throw error;
                    }
                }
            }

            isDirty = false;
            logger.info(`Saved to ${normalizedPath}`);
        } catch (error) {
            logger.error(`Save error:`, error);
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

    /**
     * Dispose of store resources.
     * Clears pending auto-save timeout and optionally saves dirty data.
     * Should be called during plugin unload to prevent memory leaks.
     *
     * @param forceSave - If true, saves dirty data before disposal (default: false)
     */
    const dispose = async (forceSave: boolean = false): Promise<void> => {
        // Clear pending auto-save timeout to prevent memory leak
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
            logger.info(`Cleared pending auto-save timeout`);
        }

        // Optionally save dirty data before disposal
        if (forceSave && isDirty) {
            try {
                await save();
                logger.info(`Saved dirty data before disposal`);
            } catch (error) {
                logger.error(`Failed to save during disposal:`, error);
            }
        }

        logger.info(`Disposed`);
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
        dispose,
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