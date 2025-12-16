// src/features/maps/state/location-marker-store.ts
// In-memory store for location markers placed on hex tiles.

import type { App, TFile} from "obsidian";
import { normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { getStoreManager } from "@services/state/store-manager";
import type { LocationType } from "@services/domain";
import type { AxialCoord } from "@geometry";
import { normalizeCoord, keyFromCoord, normalizeString } from "./store-utilities";

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
    coord: AxialCoord;
    locationName: string;
    locationType: LocationType;
    locationPath?: string; // Vault path to the location file (e.g., "Locations/MyCity.md")
    icon?: string; // Override icon (emoji or SVG path)
    parent?: string; // Parent location name
    ownerType?: "faction" | "npc" | "none";
    ownerName?: string;
}

export interface LocationMarkerEntry extends LocationMarker {
    key: string; // Coordinate key "q,r"
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
    get(coord: AxialCoord): LocationMarkerEntry | null;
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

        // CRITICAL: Also unregister from global StoreManager
        const storeName = `map-location-markers:${mapPath}`;
        getStoreManager().unregister(storeName);
    }
}

export function createLocationMarkerStore(mapPath: string): LocationMarkerStore {
    const storeName = `map-location-markers:${mapPath}`;
    const state = writable<LocationMarkerState>(createEmptyLocationMarkerState(mapPath), {
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
        state.set(createEmptyLocationMarkerState(mapPath));
    };

    const get = (coord: AxialCoord): LocationMarkerEntry | null => {
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

export function createEmptyLocationMarkerState(mapPath: string): LocationMarkerState {
    return {
        mapPath,
        loaded: false,
        entries: new Map(),
        version: Date.now(),
    };
}

// Helper functions imported from store-utils.ts
