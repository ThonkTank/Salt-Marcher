// src/features/maps/state/faction-overlay-store.ts
// In-memory store for quick faction lookups per hex on a map.

import type { App, TFile} from "obsidian";
import { normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { getStoreManager } from "@services/state/store-manager";
import { getFactionColor, DEFAULT_FACTION_COLORS } from "../config/faction-colors";
import type { AxialCoord } from "@geometry";
import { normalizeCoord, keyFromCoord, normalizeColor } from "./store-utilities";

const FALLBACK_COLOR = "#9E9E9E";

export interface FactionOverlayAssignment {
    coord: AxialCoord;
    factionId: string;
    factionName?: string;
    strength?: number;
    color?: string;
    tags?: string[];
    sourceId?: string;
}

export interface FactionOverlayEntry extends FactionOverlayAssignment {
    key: string;
    color: string;
}

export interface FactionOverlayState {
    mapPath: string;
    loaded: boolean;
    entries: Map<string, FactionOverlayEntry>;
    palette: Map<string, string>;
    version: number;
}

export interface FactionOverlayOptions {
    palette?: readonly string[];
    resolveColor?: (factionId: string, palette: Map<string, string>) => string | undefined;
}

export interface FactionOverlayStore {
    readonly state: WritableStore<FactionOverlayState>;
    setAssignments(assignments: readonly FactionOverlayAssignment[]): void;
    clear(): void;
    get(coord: AxialCoord): FactionOverlayEntry | null;
    list(): FactionOverlayEntry[];
    getColorForFaction(factionId: string): string;
}

const overlayRegistry = new WeakMap<App, Map<string, FactionOverlayStore>>();

export function getFactionOverlayStore(
    app: App,
    mapFile: TFile,
    options: FactionOverlayOptions = {}
): FactionOverlayStore {
    let storesByApp = overlayRegistry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        overlayRegistry.set(app, storesByApp);
    }

    const mapPath = normalizePath(mapFile.path);
    let store = storesByApp.get(mapPath);
    if (!store) {
        store = createFactionOverlayStore(mapPath, options);
        storesByApp.set(mapPath, store);
    }

    return store;
}

export function resetFactionOverlayStore(app: App, mapFile: TFile): void {
    const storesByApp = overlayRegistry.get(app);
    if (!storesByApp) return;

    const mapPath = normalizePath(mapFile.path);
    const store = storesByApp.get(mapPath);
    if (store) {
        store.clear();
        storesByApp.delete(mapPath);

        // CRITICAL: Also unregister from global StoreManager
        const { getStoreManager } = require("../../../services/state/store-manager");
        const storeName = `map-factions:${mapPath}`;
        getStoreManager().unregister(storeName);
    }
}

export function createFactionOverlayStore(
    mapPath: string,
    options: FactionOverlayOptions
): FactionOverlayStore {
    const storeName = `map-factions:${mapPath}`;
    const state = writable<FactionOverlayState>(createEmptyFactionOverlayState(mapPath), {
        name: storeName,
        debug: false,
    });

    getStoreManager().register(storeName, state);

    const resolveColor = (factionId: string, palette: Map<string, string>): string => {
        const normalized = factionId.trim();
        if (!normalized) return palette.get("") ?? FALLBACK_COLOR;

        const existing = palette.get(normalized);
        if (existing) return existing;

        const custom = options.resolveColor?.(normalized, palette);
        if (custom && typeof custom === "string") {
            const value = custom.trim() || FALLBACK_COLOR;
            palette.set(normalized, value);
            return value;
        }

        const color = getFactionColor(normalized, options.palette ?? DEFAULT_FACTION_COLORS);
        palette.set(normalized, color);
        return color;
    };

    const setAssignments = (assignments: readonly FactionOverlayAssignment[]) => {
        const snapshot = state.get();
        const nextEntries = new Map<string, FactionOverlayEntry>();
        const nextPalette = new Map(snapshot.palette);
        const seen = new Set<string>();

        for (const assignment of assignments) {
            if (!assignment) continue;

            const coord = normalizeCoord(assignment.coord);
            if (!coord) continue;

            const factionId = normalizeFactionId(assignment.factionId);
            if (!factionId) continue;

            const key = keyFromCoord(coord);
            if (seen.has(key)) continue;

            const overrideColor = normalizeColor(assignment.color);
            const color = overrideColor ?? resolveColor(factionId, nextPalette);
            if (overrideColor) {
                nextPalette.set(factionId, color);
            }

            const entry: FactionOverlayEntry = {
                ...assignment,
                coord,
                factionId,
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
        state.set(createEmptyFactionOverlayState(mapPath));
    };

    const get = (coord: AxialCoord): FactionOverlayEntry | null => {
        const snapshot = state.get();
        const normalized = normalizeCoord(coord);
        if (!normalized) return null;
        return snapshot.entries.get(keyFromCoord(normalized)) ?? null;
    };

    const list = (): FactionOverlayEntry[] => {
        const snapshot = state.get();
        return Array.from(snapshot.entries.values());
    };

    const getColorForFaction = (factionId: string): string => {
        const snapshot = state.get();
        const normalized = normalizeFactionId(factionId);
        if (!normalized) return FALLBACK_COLOR;
        const palette = new Map(snapshot.palette);
        const color = palette.get(normalized) ?? resolveColor(normalized, palette);

        // Ensure palette is kept in sync when resolving on-demand.
        if (!snapshot.palette.has(normalized)) {
            state.update(current => {
                const nextPalette = new Map(current.palette);
                nextPalette.set(normalized, color);
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
        getColorForFaction,
    };
}

export function createEmptyFactionOverlayState(mapPath: string): FactionOverlayState {
    return {
        mapPath,
        loaded: false,
        entries: new Map(),
        palette: new Map(),
        version: Date.now(),
    };
}

// normalizeCoord, keyFromCoord, normalizeColor imported from store-utils.ts

function normalizeFactionId(id: string | undefined | null): string {
    return typeof id === "string" ? id.trim() : "";
}
