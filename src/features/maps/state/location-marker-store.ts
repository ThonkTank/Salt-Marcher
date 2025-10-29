// src/features/maps/state/location-marker-store.ts
// In-memory store for location markers placed on hex tiles.

import { App, TFile, normalizePath } from "obsidian";
import { writable, type WritableStore } from "../../../services/state";
import { getStoreManager } from "../../../services/state/store-manager";
import type { TileCoord } from "../data/tile-repository";
import type { LocationType } from "../../../workmodes/library/locations/types";

/**
 * Icon mapping for location types.
 * Uses emoji for simplicity - can be replaced with SVG paths later.
 */
export const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
    "Stadt": "🏙️",
    "Dorf": "🏘️",
    "Weiler": "🏡",
    "Gebäude": "🏢",
    "Dungeon": "⚔️",
    "Camp": "⛺",
    "Landmark": "🗿",
    "Ruine": "🏚️",
    "Festung": "🏰",
};

export interface LocationMarker {
    coord: TileCoord;
    locationName: string;
    locationType: LocationType;
    icon?: string; // Override icon (emoji or SVG path)
    parent?: string; // Parent location name
    ownerType?: "faction" | "npc" | "none";
    ownerName?: string;
}

export interface LocationMarkerEntry extends LocationMarker {
    key: string; // Coordinate key "r:c"
    displayIcon: string; // Resolved icon (from type or override)
}

export interface LocationMarkerState {
    mapPath: string;
    loaded: boolean;
    entries: Map<string, LocationMarkerEntry>;
    version: number;
}

export interface LocationMarkerStore {
    readonly state: WritableStore<LocationMarkerState>;
    setMarkers(markers: readonly LocationMarker[]): void;
    clear(): void;
    get(coord: TileCoord): LocationMarkerEntry | null;
    list(): LocationMarkerEntry[];
    getByLocationName(name: string): LocationMarkerEntry | null;
}

const markerRegistry = new WeakMap<App, Map<string, LocationMarkerStore>>();

/**
 * Gets or creates a location marker store for a map file.
 */
export function getLocationMarkerStore(app: App, mapFile: TFile): LocationMarkerStore {
    let storesByApp = markerRegistry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        markerRegistry.set(app, storesByApp);
    }

    const mapPath = normalizePath(mapFile.path);
    let store = storesByApp.get(mapPath);
    if (!store) {
        store = createLocationMarkerStore(mapPath);
        storesByApp.set(mapPath, store);
    }

    return store;
}

/**
 * Resets (clears and removes) the location marker store for a map file.
 */
export function resetLocationMarkerStore(app: App, mapFile: TFile): void {
    const storesByApp = markerRegistry.get(app);
    if (!storesByApp) return;

    const mapPath = normalizePath(mapFile.path);
    const store = storesByApp.get(mapPath);
    if (store) {
        store.clear();
        storesByApp.delete(mapPath);
    }
}

function createLocationMarkerStore(mapPath: string): LocationMarkerStore {
    const storeName = `map-location-markers:${mapPath}`;
    const state = writable<LocationMarkerState>(createEmptyState(mapPath), {
        name: storeName,
        debug: false,
    });

    getStoreManager().register(storeName, state);

    const setMarkers = (markers: readonly LocationMarker[]) => {
        const nextEntries = new Map<string, LocationMarkerEntry>();
        const seen = new Set<string>();

        for (const marker of markers) {
            if (!marker) continue;

            const coord = normalizeCoord(marker.coord);
            if (!coord) continue;

            const locationName = normalizeString(marker.locationName);
            if (!locationName) continue;

            const key = keyFromCoord(coord);
            if (seen.has(key)) continue; // Skip duplicate coords

            const displayIcon = marker.icon || LOCATION_TYPE_ICONS[marker.locationType] || "📍";

            const entry: LocationMarkerEntry = {
                ...marker,
                coord,
                locationName,
                key,
                displayIcon,
            };

            nextEntries.set(key, entry);
            seen.add(key);
        }

        state.set({
            mapPath,
            loaded: true,
            entries: nextEntries,
            version: Date.now(),
        });
    };

    const clear = () => {
        state.set(createEmptyState(mapPath));
    };

    const get = (coord: TileCoord): LocationMarkerEntry | null => {
        const snapshot = state.get();
        const normalized = normalizeCoord(coord);
        if (!normalized) return null;
        return snapshot.entries.get(keyFromCoord(normalized)) ?? null;
    };

    const list = (): LocationMarkerEntry[] => {
        const snapshot = state.get();
        return Array.from(snapshot.entries.values());
    };

    const getByLocationName = (name: string): LocationMarkerEntry | null => {
        const snapshot = state.get();
        const normalized = normalizeString(name);
        if (!normalized) return null;

        for (const entry of snapshot.entries.values()) {
            if (entry.locationName === normalized) {
                return entry;
            }
        }
        return null;
    };

    return {
        state,
        setMarkers,
        clear,
        get,
        list,
        getByLocationName,
    };
}

function createEmptyState(mapPath: string): LocationMarkerState {
    return {
        mapPath,
        loaded: false,
        entries: new Map(),
        version: Date.now(),
    };
}

function normalizeCoord(coord: TileCoord | undefined | null): TileCoord | null {
    if (!coord) return null;
    const r = Number(coord.r);
    const c = Number(coord.c);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { r, c };
}

function normalizeString(str: string | undefined | null): string {
    return typeof str === "string" ? str.trim() : "";
}

function keyFromCoord(coord: TileCoord): string {
    return `${coord.r}:${coord.c}`;
}
