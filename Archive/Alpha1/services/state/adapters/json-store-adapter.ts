// src/services/state/adapters/json-store-adapter.ts
// Adapter to bridge existing JsonStore-like persistence helpers onto the unified state interfaces.

import { writable } from "../writable-store";
import type { PersistentStore, StoreOptions, Updater } from "../store.interface";

export interface JsonStoreLike<T> {
    read(): Promise<T>;
    update(updater: (draft: T) => void | T): Promise<T>;
}

export interface JsonStorePersistentAdapterOptions<T> extends StoreOptions {
    /**
     * Storage backend with read/update semantics (e.g. JsonStore).
     */
    backend: JsonStoreLike<T>;

    /**
     * Initial in-memory value before the first load.
     */
    initialValue: T;

    /**
     * Stable storage identifier used for diagnostics.
     */
    storageKey: string;
}

/**
 * Wraps a JsonStore-like backend inside the PersistentStore interface so the new state platform can manage it.
 */
export function createJsonStorePersistentAdapter<T>(
    options: JsonStorePersistentAdapterOptions<T>
): PersistentStore<T> {
    const { backend, initialValue, storageKey, ...storeOptions } = options;
    const internal = writable<T>(initialValue, storeOptions);

    let dirty = false;

    const subscribe = internal.subscribe;
    const get = internal.get;

    const set = (value: T): void => {
        internal.set(value);
        dirty = true;
    };

    const update = (updater: Updater<T>): void => {
        internal.update(currentValue => {
            const nextValue = updater(currentValue);
            dirty = true;
            return nextValue;
        });
    };

    const load = async (): Promise<void> => {
        const value = await backend.read();
        internal.set(value);
        dirty = false;
    };

    const save = async (): Promise<void> => {
        const value = internal.get();
        await backend.update(() => value);
        dirty = false;
    };

    const isDirty = (): boolean => dirty;

    const getStorageKey = (): string => storageKey;

    return {
        subscribe,
        get,
        set,
        update,
        load,
        save,
        isDirty,
        getStorageKey,
    };
}
