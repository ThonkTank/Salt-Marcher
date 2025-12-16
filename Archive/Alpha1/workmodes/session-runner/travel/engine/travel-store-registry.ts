// src/workmodes/session-runner/travel/engine/travel-store-registry.ts
// Registry für den internen Travel Store - ermöglicht reaktive Subscriptions.

import type { Store } from "./state.store";
import { configurableLogger } from "@services/logging/configurable-logger";

// Re-export Store type for consumers
export type { Store };

const logger = configurableLogger.forModule("session-travel-registry");

let travelStore: Store | null = null;
let currentMapPath: string | null = null;

/**
 * Register the travel store instance (called when TravelLogic is created).
 * This allows other components to subscribe reactively to travel state changes.
 */
export function setTravelStore(store: Store, mapPath: string): void {
    travelStore = store;
    currentMapPath = mapPath;
    logger.info("Store registered", { mapPath });
}

/**
 * Get the current travel store instance.
 * Returns null if TravelLogic hasn't been created yet.
 */
export function getTravelStore(): Store | null {
    return travelStore;
}

/**
 * Get the current map path associated with the travel store.
 */
export function getCurrentMapPath(): string | null {
    return currentMapPath;
}

/**
 * Clear the travel store (called when TravelLogic is disposed).
 */
export function clearTravelStore(): void {
    if (travelStore) {
        logger.info("Store cleared", { mapPath: currentMapPath });
    }
    travelStore = null;
    currentMapPath = null;
}
