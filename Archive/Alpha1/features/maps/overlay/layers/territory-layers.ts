// src/features/maps/overlay/layers/territory-layers.ts
// Territory overlay layers for faction and location influence areas
//
// Provides:
// - Faction overlay: Colored territories for faction control areas
// - Location influence: Colored areas for location influence zones
//
// Both layers share:
// - Internal state management with WritableStore
// - Color palette resolution
// - Assignment-based data API
//
// CONSOLIDATED: Merged from faction-overlay-layer.ts, location-influence-layer.ts

import type { App, TFile } from "obsidian";
import { normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { coordToKey } from "@geometry";
import type { HexCoord } from "../../rendering/rendering-types";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import { LAYER_PRIORITY } from "../layer-registry";
import { getFactionColor, DEFAULT_FACTION_COLORS } from "../../config/faction-colors";
import type { LocationType } from "@services/domain";

// =============================================================================
// SHARED HELPERS
// =============================================================================

const FALLBACK_COLOR = "#9E9E9E";

/**
 * Normalize coordinate for consistent handling.
 * Validates that q and r are integers.
 */
function normalizeCoord(coord: HexCoord | undefined | null): HexCoord | null {
    if (!coord) return null;
    const q = Number(coord.q);
    const r = Number(coord.r);
    if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
    return { q, r };
}

/**
 * Normalize string by trimming whitespace.
 */
function normalizeString(str: string | undefined | null): string {
    return typeof str === "string" ? str.trim() : "";
}

/**
 * Normalize color string, returning null if invalid.
 */
function normalizeColor(color: string | undefined): string | null {
    if (!color) return null;
    const trimmed = color.trim();
    if (!trimmed) return null;
    return trimmed;
}

/**
 * Simple hash function for string to number.
 * Used for consistent color assignment.
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

// =============================================================================
// FACTION OVERLAY LAYER
// =============================================================================

/**
 * Faction overlay assignment data from external sources
 */
interface FactionOverlayAssignment {
    coord: HexCoord;
    factionId: string;
    factionName?: string;
    strength?: number;
    color?: string;
    tags?: string[];
    sourceId?: string;
}

/**
 * Internal faction overlay entry with resolved color
 */
interface FactionOverlayEntry extends FactionOverlayAssignment {
    key: string;
    color: string;
}

/**
 * Internal state for faction overlay layer
 */
interface FactionOverlayState {
    entries: Map<string, FactionOverlayEntry>;
    palette: Map<string, string>;
}

/**
 * Create faction overlay layer
 *
 * Renders faction territories as colored overlays with configurable opacity and stroke.
 * Priority: FACTION (above location influence, below markers)
 *
 * @example
 * ```typescript
 * const factionLayer = createFactionOverlayLayer(app, mapFile);
 * overlayManager.register(factionLayer);
 * ```
 */
export function createFactionOverlayLayer(
    app: App,
    mapFile: TFile
): SimpleOverlayLayer {
    const mapPath = normalizePath(mapFile.path);

    // Internal state - not exposed
    const state: WritableStore<FactionOverlayState> = writable({
        entries: new Map(),
        palette: new Map(),
    });

    // Cleanup functions collection
    const cleanups: Array<() => void> = [];

    // Color resolution function
    const resolveColor = (factionId: string, palette: Map<string, string>): string => {
        const normalized = factionId.trim();
        if (!normalized) return palette.get("") ?? FALLBACK_COLOR;

        const existing = palette.get(normalized);
        if (existing) return existing;

        const color = getFactionColor(normalized, DEFAULT_FACTION_COLORS);
        palette.set(normalized, color);
        return color;
    };

    // Public API for updating layer data (used by external sources)
    const setAssignments = (assignments: readonly FactionOverlayAssignment[]) => {
        const snapshot = state.get();
        const nextEntries = new Map<string, FactionOverlayEntry>();
        const nextPalette = new Map(snapshot.palette);
        const seen = new Set<string>();

        for (const assignment of assignments) {
            if (!assignment) continue;

            const coord = normalizeCoord(assignment.coord);
            if (!coord) continue;

            const factionId = normalizeString(assignment.factionId);
            if (!factionId) continue;

            const key = coordToKey(coord);
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
            entries: nextEntries,
            palette: nextPalette,
        });
    };

    return {
        id: "faction-overlay",
        name: "Faction Territories",
        priority: LAYER_PRIORITY.FACTION,

        getCoordinates(): readonly HexCoord[] {
            const s = state.get();
            return Array.from(s.entries.values()).map(entry => entry.coord);
        },

        getRenderData(coord: HexCoord): OverlayRenderData | null {
            const s = state.get();
            const entry = s.entries.get(coordToKey(coord));
            if (!entry) return null;

            return {
                type: "fill",
                color: entry.color,
                fillOpacity: "0.55",
                strokeWidth: "3",
                metadata: {
                    label: entry.factionId,
                    tooltip: entry.factionName ?? entry.factionId,
                    factionId: entry.factionId,
                    factionName: entry.factionName,
                    strength: entry.strength,
                    tags: entry.tags,
                },
            };
        },

        subscribe(callback: () => void): () => void {
            return state.subscribe(callback);
        },

        destroy(): void {
            cleanups.forEach(cleanup => cleanup());
        },
    };
}

// =============================================================================
// LOCATION INFLUENCE LAYER
// =============================================================================

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
 * Location influence assignment data from external sources
 */
interface LocationInfluenceAssignment {
    coord: HexCoord;
    locationName: string;
    locationType: LocationType;
    strength: number; // 0-100
    ownerType?: "faction" | "npc" | "none";
    ownerName?: string;
    color?: string; // Optional color override
}

/**
 * Internal location influence entry with resolved color
 */
interface LocationInfluenceEntry extends LocationInfluenceAssignment {
    key: string;
    color: string;
}

/**
 * Internal state for location influence layer
 */
interface LocationInfluenceState {
    entries: Map<string, LocationInfluenceEntry>;
    palette: Map<string, string>; // owner -> color
}

/**
 * Create location influence layer
 *
 * Renders location influence areas as colored overlays with reduced opacity.
 * Priority: INFLUENCE (below faction overlays, showing territorial control by locations)
 *
 * @example
 * ```typescript
 * const influenceLayer = createLocationInfluenceLayer(app, mapFile);
 * overlayManager.register(influenceLayer);
 * ```
 */
export function createLocationInfluenceLayer(
    app: App,
    mapFile: TFile
): SimpleOverlayLayer {
    const mapPath = normalizePath(mapFile.path);

    // Internal state - not exposed
    const state: WritableStore<LocationInfluenceState> = writable({
        entries: new Map(),
        palette: new Map(),
    });

    // Cleanup functions collection
    const cleanups: Array<() => void> = [];

    // Color resolution function
    const resolveColor = (ownerName: string, ownerType: string, palette: Map<string, string>): string => {
        const normalized = `${ownerType}:${ownerName.trim()}`;
        if (!normalized) return palette.get("") ?? FALLBACK_COLOR;

        const existing = palette.get(normalized);
        if (existing) return existing;

        // Default color assignment based on hash
        const hash = hashString(normalized);
        const color = DEFAULT_INFLUENCE_COLORS[hash % DEFAULT_INFLUENCE_COLORS.length];
        palette.set(normalized, color);
        return color;
    };

    // Public API for updating layer data (used by external sources)
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

            const key = coordToKey(coord);
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
            entries: nextEntries,
            palette: nextPalette,
        });
    };

    return {
        id: "location-influence",
        name: "Location Influence",
        priority: LAYER_PRIORITY.INFLUENCE,

        getCoordinates(): readonly HexCoord[] {
            const s = state.get();
            return Array.from(s.entries.values()).map(entry => entry.coord);
        },

        getRenderData(coord: HexCoord): OverlayRenderData | null {
            const s = state.get();
            const entry = s.entries.get(coordToKey(coord));
            if (!entry) return null;

            return {
                type: "fill",
                color: entry.color,
                fillOpacity: "0.35", // Lower opacity to layer under faction overlays
                strokeWidth: "2",
                metadata: {
                    label: `location:${entry.locationName}`,
                    tooltip: `${entry.locationName} (${entry.strength}%)`,
                    locationName: entry.locationName,
                    locationType: entry.locationType,
                    strength: entry.strength,
                    ownerType: entry.ownerType,
                    ownerName: entry.ownerName,
                },
            };
        },

        subscribe(callback: () => void): () => void {
            return state.subscribe(callback);
        },

        destroy(): void {
            cleanups.forEach(cleanup => cleanup());
        },
    };
}
