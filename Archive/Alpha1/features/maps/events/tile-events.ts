// src/features/maps/events/tile-events.ts
// Event-based tile change notification system
//
// Breaks circular dependency: tile-repository -> map-store-registry -> weather-overlay-store -> tile-repository
// Overlay stores subscribe to events instead of importing getTileStore directly.

import type { AxialCoord, CoordKey } from "@geometry";
import type { TileData } from "@domain";
import type { Unsubscriber } from "@services/state";

/**
 * Event emitted when tiles change in a map.
 * Used by overlay stores (weather, faction) to react to tile changes
 * without creating circular dependencies.
 */
export interface TileChangeEvent {
    mapPath: string;
    changes: TileChange[];
    /** Timestamp of the change */
    timestamp: number;
}

export interface TileChange {
    coord: AxialCoord;
    key: CoordKey;
    data: TileData | null; // null = deleted
    previousData: TileData | null;
}

/**
 * Callback type for tile change subscribers
 */
export type TileChangeCallback = (event: TileChangeEvent) => void;

/**
 * Tile Event Bus - singleton for all tile change events
 *
 * Usage:
 * - TileCache emits events on mutations
 * - Overlay stores subscribe to specific map paths
 * - No circular dependencies between tile-repository and overlay stores
 */
class TileEventBusImpl {
    // Per-map subscribers
    private mapSubscribers = new Map<string, Set<TileChangeCallback>>();
    // Global subscribers (all maps)
    private globalSubscribers = new Set<TileChangeCallback>();

    /**
     * Emit a tile change event.
     * Called by TileCache when tiles are mutated.
     */
    emit(event: TileChangeEvent): void {
        // Notify map-specific subscribers
        const mapSubs = this.mapSubscribers.get(event.mapPath);
        if (mapSubs) {
            for (const callback of mapSubs) {
                try {
                    callback(event);
                } catch (error) {
                    console.error(`[tile-events] Error in map subscriber for ${event.mapPath}:`, error);
                }
            }
        }

        // Notify global subscribers
        for (const callback of this.globalSubscribers) {
            try {
                callback(event);
            } catch (error) {
                console.error(`[tile-events] Error in global subscriber:`, error);
            }
        }
    }

    /**
     * Subscribe to tile changes for a specific map.
     * Returns unsubscribe function.
     */
    subscribe(mapPath: string, callback: TileChangeCallback): Unsubscriber {
        let subs = this.mapSubscribers.get(mapPath);
        if (!subs) {
            subs = new Set();
            this.mapSubscribers.set(mapPath, subs);
        }
        subs.add(callback);

        return () => {
            subs!.delete(callback);
            if (subs!.size === 0) {
                this.mapSubscribers.delete(mapPath);
            }
        };
    }

    /**
     * Subscribe to tile changes for all maps.
     * Returns unsubscribe function.
     */
    subscribeAll(callback: TileChangeCallback): Unsubscriber {
        this.globalSubscribers.add(callback);
        return () => {
            this.globalSubscribers.delete(callback);
        };
    }

    /**
     * Clear all subscribers for a map (cleanup on map close).
     */
    clearMap(mapPath: string): void {
        this.mapSubscribers.delete(mapPath);
    }

    /**
     * Clear all subscribers (plugin unload).
     */
    clearAll(): void {
        this.mapSubscribers.clear();
        this.globalSubscribers.clear();
    }
}

// Singleton instance
const tileEventBus = new TileEventBusImpl();

/**
 * Get the tile event bus singleton.
 */
export function getTileEventBus(): TileEventBusImpl {
    return tileEventBus;
}

// Export type for consumers
export type TileEventBus = TileEventBusImpl;
