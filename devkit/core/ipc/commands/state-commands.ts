// devkit/core/ipc/commands/state-commands.ts
// IPC commands for inspecting the global state/store layer

import type { App } from "obsidian";
import { logger } from "../../../../src/app/plugin-logger";
import { getStoreManager } from "../../../../src/services/state/store-manager";
import { eventBus, EventTopic } from "../../../../src/services/events";
import type { ReadableStore } from "../../../../src/services/state";

const MAX_PREVIEW_LENGTH = 200;
const MAX_ARRAY_ITEMS = 20;
const MAX_DEPTH = 3;

interface StoreSummary {
    name: string;
    capabilities: string[];
    type: "readable" | "writable" | "persistent";
    isPersistent: boolean;
    isWritable: boolean;
    isDirty?: boolean;
    storageKey?: string;
    metadata?: unknown;
    valueType?: string;
    valuePreview?: string;
    valueError?: string;
}

interface StoreDetail extends StoreSummary {
    found: boolean;
    value?: unknown;
}

/**
 * List all registered stores with high-level metadata.
 */
export async function listStores(app: App): Promise<{
    stores: StoreSummary[];
    stats: {
        totalStores: number;
        persistentStores: number;
        writableStores: number;
        readableStores: number;
    };
    eventBus: {
        totalSubscriptions: number;
        topics: Array<{ topic: EventTopic; subscriptions: number }>;
    };
}> {
    logger.log("[IPC-CMD] Listing registered stores");

    const manager = getStoreManager();
    const storeNames = manager.list();

    const summaries = storeNames.map((name) => {
        const store = manager.get(name) as ReadableStore<unknown> | undefined;
        return summarizeStore(name, store);
    }).filter((summary): summary is StoreSummary => summary !== null);

    const stats = {
        totalStores: summaries.length,
        persistentStores: summaries.filter((summary) => summary.isPersistent).length,
        writableStores: summaries.filter((summary) => summary.isWritable).length,
        readableStores: summaries.filter((summary) => summary.type === "readable").length,
    };

    const topics = Object.values(EventTopic).map((topic) => ({
        topic,
        subscriptions: eventBus.getTopicSubscriptionCount(topic),
    }));

    return {
        stores: summaries,
        stats,
        eventBus: {
            totalSubscriptions: eventBus.getSubscriptionCount(),
            topics,
        },
    };
}

/**
 * Inspect a single store and return serialized data with metadata.
 */
export async function inspectStore(app: App, args: string[]): Promise<StoreDetail> {
    const [storeName] = args;

    if (!storeName) {
        throw new Error("Store name required");
    }

    logger.log(`[IPC-CMD] Inspecting store: ${storeName}`);

    const manager = getStoreManager();
    const store = manager.get(storeName) as ReadableStore<unknown> | undefined;

    if (!store) {
        return {
            name: storeName,
            capabilities: [],
            type: "readable",
            isPersistent: false,
            isWritable: false,
            found: false,
            valuePreview: undefined,
        };
    }

    const summary = summarizeStore(storeName, store, { includeValue: true });
    return {
        ...summary,
        found: true,
    };
}

/**
 * Summarize a store instance into serializable data.
 */
function summarizeStore(
    name: string,
    store: ReadableStore<unknown> | undefined,
    options: { includeValue?: boolean } = {}
): StoreSummary | StoreDetail | null {
    if (!store) return null;

    const isWritable = typeof (store as any).set === "function";
    const isPersistent = typeof (store as any).save === "function" && typeof (store as any).load === "function";
    const hasMetadata = typeof (store as any).getMetadata === "function";
    const capabilities = ["readable"];
    if (isWritable) capabilities.push("writable");
    if (isPersistent) capabilities.push("persistent");

    let metadata: unknown;
    if (hasMetadata) {
        try {
            metadata = sanitizeValue((store as any).getMetadata());
        } catch (error) {
            metadata = { error: `Failed to read metadata: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    let storageKey: string | undefined;
    if (isPersistent && typeof (store as any).getStorageKey === "function") {
        try {
            storageKey = (store as any).getStorageKey();
        } catch (error) {
            storageKey = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    let isDirty: boolean | undefined;
    if (isPersistent && typeof (store as any).isDirty === "function") {
        try {
            isDirty = (store as any).isDirty();
        } catch (error) {
            isDirty = undefined;
        }
    }

    let valueType: string | undefined;
    let valuePreview: string | undefined;
    let valueError: string | undefined;
    let serializedValue: unknown;

    try {
        const value = store.get();
        valueType = determineType(value);
        serializedValue = sanitizeValue(value);
        valuePreview = createPreview(serializedValue);
    } catch (error) {
        valueError = `Failed to read value: ${error instanceof Error ? error.message : String(error)}`;
    }

    if (options.includeValue) {
        return {
            name,
            capabilities,
            type: determineStoreType(isPersistent, isWritable),
            isPersistent,
            isWritable,
            isDirty,
            storageKey,
            metadata,
            valueType,
            valuePreview,
            valueError,
            value: serializedValue,
        } as StoreDetail;
    }

    return {
        name,
        capabilities,
        type: determineStoreType(isPersistent, isWritable),
        isPersistent,
        isWritable,
        isDirty,
        storageKey,
        metadata,
        valueType,
        valuePreview,
        valueError,
    };
}

/**
 * Determine a human-readable type label.
 */
function determineStoreType(isPersistent: boolean, isWritable: boolean): "readable" | "writable" | "persistent" {
    if (isPersistent) return "persistent";
    if (isWritable) return "writable";
    return "readable";
}

/**
 * Produce a short preview string of the serialized value.
 */
function createPreview(value: unknown): string | undefined {
    if (typeof value === "undefined") return undefined;

    try {
        const json = JSON.stringify(value);
        if (!json) return undefined;
        if (json.length <= MAX_PREVIEW_LENGTH) {
            return json;
        }
        return `${json.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
    } catch (error) {
        return `[unserializable: ${error instanceof Error ? error.message : typeof value}]`;
    }
}

/**
 * Determine runtime type of value for diagnostics.
 */
function determineType(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (value instanceof Map) return "Map";
    if (value instanceof Set) return "Set";
    if (value instanceof Date) return "Date";
    if (value instanceof RegExp) return "RegExp";
    return typeof value;
}

/**
 * Safely serialize arbitrary values for transport over IPC.
 */
function sanitizeValue(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown {
    if (value === null || typeof value !== "object") {
        if (typeof value === "function") {
            return `[Function ${value.name || "anonymous"}]`;
        }
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value instanceof RegExp) {
        return value.toString();
    }

    if (value instanceof Map) {
        const entries = Array.from(value.entries()).slice(0, MAX_ARRAY_ITEMS);
        return entries.map(([key, val]) => [
            sanitizeValue(key, seen, depth + 1),
            sanitizeValue(val, seen, depth + 1),
        ]);
    }

    if (value instanceof Set) {
        return Array.from(value.values())
            .slice(0, MAX_ARRAY_ITEMS)
            .map((item) => sanitizeValue(item, seen, depth + 1));
    }

    if (seen.has(value)) {
        return "[Circular]";
    }
    seen.add(value);

    if (depth >= MAX_DEPTH) {
        const ctor = (value as { constructor?: { name?: string } }).constructor;
        return `[Object ${ctor?.name || "Object"}]`;
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        result[key] = sanitizeValue(val, seen, depth + 1);
    }

    return result;
}
