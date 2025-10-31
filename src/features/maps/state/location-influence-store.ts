/**
 * src/features/maps/state/location-influence-store.ts
 * Phase 9.1: In-memory store for location influence areas on the map
 *
 * Purpose: Display faction/NPC-controlled territories based on owned locations.
 * Integrates with Phase 9 location influence calculation system.
 * Provides reactive store for map overlays showing location influence strength.
 */

import { App, TFile, normalizePath } from "obsidian";
import { writable, type WritableStore } from "../../../services/state";
import { getStoreManager } from "../../../services/state/store-manager";
import type { TileCoord } from "../data/tile-repository";
import type { LocationType } from "../../../workmodes/library/locations/types";

const FALLBACK_COLOR = "#9E9E9E";

/**
 * Location influence assignment for a hex
 */
export interface LocationInfluenceAssignment {
    coord: TileCoord;
    locationName: string;
    locationType: LocationType;
    strength: number; // 0-100
    ownerType?: "faction" | "npc" | "none";
    ownerName?: string;
    color?: string; // Optional color override
}

/**
 * Location influence entry with resolved color
 */
export interface LocationInfluenceEntry extends LocationInfluenceAssignment {
    key: string; // Coordinate key "r:c"
    color: string; // Resolved color
}

/**
 * Location influence store state
 */
export interface LocationInfluenceState {
    mapPath: string;
    loaded: boolean;
    entries: Map<string, LocationInfluenceEntry>;
    palette: Map<string, string>; // owner -> color
    version: number;
}

/**
 * Color resolution options
 */
export interface LocationInfluenceOptions {
    palette?: readonly string[];
    resolveColor?: (ownerName: string, ownerType: string, palette: Map<string, string>) => string | undefined;
}

/**
 * Location influence store interface
 */
export interface LocationInfluenceStore {
    readonly state: WritableStore<LocationInfluenceState>;
    setAssignments(assignments: readonly LocationInfluenceAssignment[]): void;
    clear(): void;
    get(coord: TileCoord): LocationInfluenceEntry | null;
    list(): LocationInfluenceEntry[];
    getColorForOwner(ownerName: string, ownerType: string): string;
}

const influenceRegistry = new WeakMap<App, Map<string, LocationInfluenceStore>>();

/**
 * Default color palette for location influence
 */
const DEFAULT_INFLUENCE_COLORS = [
    "#FF6B6B", // Red
    "#4ECDC4", // Teal
    "#FFE66D", // Yellow
    "#A8E6CF", // Mint
    "#FFD3B6", // Peach
    "#FFAAA5", // Coral
    "#98D8C8", // Seafoam
    "#C7CEEA", // Lavender
    "#B8E0D2", // Sage
    "#EAC4D5", // Pink
];

/**
 * Get or create location influence store for a map file
 */
export function getLocationInfluenceStore(
    app: App,
    mapFile: TFile,
    options: LocationInfluenceOptions = {}
): LocationInfluenceStore {
    let storesByApp = influenceRegistry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        influenceRegistry.set(app, storesByApp);
    }

    const mapPath = normalizePath(mapFile.path);
    let store = storesByApp.get(mapPath);
    if (!store) {
        store = createLocationInfluenceStore(mapPath, options);
        storesByApp.set(mapPath, store);
    }

    return store;
}

/**
 * Reset (clear and remove) the location influence store for a map file
 */
export function resetLocationInfluenceStore(app: App, mapFile: TFile): void {
    const storesByApp = influenceRegistry.get(app);
    if (!storesByApp) return;

    const mapPath = normalizePath(mapFile.path);
    const store = storesByApp.get(mapPath);
    if (store) {
        store.clear();
        storesByApp.delete(mapPath);
    }
}

function createLocationInfluenceStore(
    mapPath: string,
    options: LocationInfluenceOptions
): LocationInfluenceStore {
    const storeName = `map-location-influence:${mapPath}`;
    const state = writable<LocationInfluenceState>(createEmptyState(mapPath), {
        name: storeName,
        debug: false,
    });

    getStoreManager().register(storeName, state);

    const resolveColor = (ownerName: string, ownerType: string, palette: Map<string, string>): string => {
        const normalized = `${ownerType}:${ownerName.trim()}`;
        if (!normalized) return palette.get("") ?? FALLBACK_COLOR;

        const existing = palette.get(normalized);
        if (existing) return existing;

        const custom = options.resolveColor?.(ownerName, ownerType, palette);
        if (custom && typeof custom === "string") {
            const value = custom.trim() || FALLBACK_COLOR;
            palette.set(normalized, value);
            return value;
        }

        // Default color assignment based on hash
        const colors = options.palette ?? DEFAULT_INFLUENCE_COLORS;
        const hash = hashString(normalized);
        const color = colors[hash % colors.length];
        palette.set(normalized, color);
        return color;
    };

    const setAssignments = (assignments: readonly LocationInfluenceAssignment[]) => {
        const snapshot = state.get();
        const nextEntries = new Map<string, LocationInfluenceEntry>();
        const nextPalette = new Map(snapshot.palette);
        const seen = new Set<string>();

        for (const assignment of assignments) {
            if (!assignment) continue;

            const coord = normalizeCoord(assignment.coord);
            if (!coord) continue;

            const locationName = normalizeString(assignment.locationName);
            if (!locationName) continue;

            const key = keyFromCoord(coord);
            if (seen.has(key)) continue;

            // Use override color or resolve from owner
            const overrideColor = normalizeColor(assignment.color);
            const ownerType = assignment.ownerType || "none";
            const ownerName = assignment.ownerName || locationName;

            const color = overrideColor ?? resolveColor(ownerName, ownerType, nextPalette);
            if (overrideColor) {
                const paletteKey = `${ownerType}:${ownerName}`;
                nextPalette.set(paletteKey, color);
            }

            const entry: LocationInfluenceEntry = {
                ...assignment,
                coord,
                locationName,
                color,
                key,
            };

            nextEntries.set(key, entry);
            seen.add(key);
        }

        state.set({
            mapPath,
            loaded: true,
            entries: nextEntries,
            palette: nextPalette,
            version: Date.now(),
        });
    };

    const clear = () => {
        state.set(createEmptyState(mapPath));
    };

    const get = (coord: TileCoord): LocationInfluenceEntry | null => {
        const snapshot = state.get();
        const normalized = normalizeCoord(coord);
        if (!normalized) return null;
        return snapshot.entries.get(keyFromCoord(normalized)) ?? null;
    };

    const list = (): LocationInfluenceEntry[] => {
        const snapshot = state.get();
        return Array.from(snapshot.entries.values());
    };

    const getColorForOwner = (ownerName: string, ownerType: string): string => {
        const snapshot = state.get();
        const paletteKey = `${ownerType}:${ownerName.trim()}`;
        const palette = new Map(snapshot.palette);
        const color = palette.get(paletteKey) ?? resolveColor(ownerName, ownerType, palette);

        // Ensure palette is kept in sync when resolving on-demand
        if (!snapshot.palette.has(paletteKey)) {
            state.update(current => {
                const nextPalette = new Map(current.palette);
                nextPalette.set(paletteKey, color);
                return {
                    ...current,
                    palette: nextPalette,
                    version: Date.now(),
                };
            });
        }

        return color;
    };

    return {
        state,
        setAssignments,
        clear,
        get,
        list,
        getColorForOwner,
    };
}

function createEmptyState(mapPath: string): LocationInfluenceState {
    return {
        mapPath,
        loaded: false,
        entries: new Map(),
        palette: new Map(),
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

function normalizeColor(color: string | undefined): string | null {
    if (!color) return null;
    const trimmed = color.trim();
    if (!trimmed) return null;
    return trimmed;
}

/**
 * Simple hash function for string to number
 */
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}
