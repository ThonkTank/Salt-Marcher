// src/services/state/store.interface.ts
// Unified store interfaces for state management across Salt Marcher
// Provides consistent patterns for readable, writable, and persistent stores

/**
 * Subscription cleanup function - call to unsubscribe
 */
export type Unsubscriber = () => void;

/**
 * Store subscriber function - called when store value changes
 */
export type Subscriber<T> = (value: T) => void;

/**
 * Store updater function - receives current value, returns new value
 */
export type Updater<T> = (value: T) => T;

/**
 * Base readable store interface
 * Provides subscription and value access
 */
export interface ReadableStore<T> {
    /**
     * Subscribe to store changes
     * @param subscriber Function called with current value immediately and on each change
     * @returns Unsubscriber function to stop listening
     */
    subscribe(subscriber: Subscriber<T>): Unsubscriber;

    /**
     * Get current store value synchronously
     * @returns Current store value
     */
    get(): T;
}

/**
 * Writable store extends readable with mutation capabilities
 */
export interface WritableStore<T> extends ReadableStore<T> {
    /**
     * Set store to a new value
     * @param value New value to set
     */
    set(value: T): void;

    /**
     * Update store value using an updater function
     * @param updater Function that receives current value and returns new value
     */
    update(updater: Updater<T>): void;
}

/**
 * Persistent store extends writable with persistence capabilities
 */
export interface PersistentStore<T> extends WritableStore<T> {
    /**
     * Load store value from persistent storage
     * @returns Promise resolving when load is complete
     */
    load(): Promise<void>;

    /**
     * Save current store value to persistent storage
     * @returns Promise resolving when save is complete
     */
    save(): Promise<void>;

    /**
     * Check if store has been modified since last save
     * @returns True if store has unsaved changes
     */
    isDirty(): boolean;

    /**
     * Get storage path/key for this store
     * @returns Storage identifier
     */
    getStorageKey(): string;

    /**
     * Dispose of store resources (cleanup timeouts, etc.)
     * Should be called during plugin unload to prevent memory leaks
     * @param forceSave - If true, saves dirty data before disposal
     * @returns Promise resolving when disposal is complete
     */
    dispose(forceSave?: boolean): Promise<void>;
}

/**
 * Store metadata for migration and versioning
 */
export interface StoreMetadata {
    /**
     * Store schema version for migrations
     */
    version: number;

    /**
     * Store type identifier
     */
    type: string;

    /**
     * Last modified timestamp
     */
    lastModified?: string;

    /**
     * Optional store-specific metadata
     */
    custom?: Record<string, unknown>;
}

/**
 * Store with metadata support for versioning and migrations
 */
export interface VersionedStore<T> extends PersistentStore<T> {
    /**
     * Get store metadata
     */
    getMetadata(): StoreMetadata;

    /**
     * Migrate store data from old version to current
     * @param data Data from persistent storage
     * @param fromVersion Version of the stored data
     * @returns Migrated data compatible with current version
     */
    migrate(data: unknown, fromVersion: number): T;
}

/**
 * Store factory function type
 */
export type StoreFactory<T, S extends ReadableStore<T> = ReadableStore<T>> = (
    initialValue: T,
    options?: StoreOptions
) => S;

/**
 * Common store options
 */
export interface StoreOptions {
    /**
     * Enable debug logging for this store
     */
    debug?: boolean;

    /**
     * Store name for logging and debugging
     */
    name?: string;

    /**
     * Auto-save delay in milliseconds (for persistent stores)
     */
    autoSaveDelay?: number;

    /**
     * Storage key override (for persistent stores)
     */
    storageKey?: string;
}

/**
 * Store event types for diagnostics and debugging
 */
export enum StoreEvent {
    INITIALIZED = "initialized",
    SUBSCRIBED = "subscribed",
    UNSUBSCRIBED = "unsubscribed",
    VALUE_CHANGED = "value_changed",
    LOADED = "loaded",
    SAVED = "saved",
    ERROR = "error",
}

/**
 * Store event payload for diagnostics
 */
export interface StoreEventPayload<T = unknown> {
    storeName: string;
    event: StoreEvent;
    timestamp: string;
    value?: T;
    previousValue?: T;
    error?: Error;
    metadata?: Record<string, unknown>;
}

/**
 * Store manager interface for coordinating multiple stores
 */
export interface StoreManager {
    /**
     * Register a store with the manager
     */
    register<T>(name: string, store: ReadableStore<T>): void;

    /**
     * Unregister a store from the manager
     */
    unregister(name: string): void;

    /**
     * Check if a store is registered
     */
    has(name: string): boolean;

    /**
     * Get a registered store by name
     */
    get<T>(name: string): ReadableStore<T> | undefined;

    /**
     * List all registered store names
     */
    list(): string[];

    /**
     * Save all persistent stores
     */
    saveAll(): Promise<void>;

    /**
     * Load all persistent stores
     */
    loadAll(): Promise<void>;

    /**
     * Dispose of all stores and cleanup
     */
    dispose(): void;
}