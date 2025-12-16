// src/features/maps/overlay/layers/marker-layers.ts
// Marker overlay layers for location markers and building indicators
//
// Provides:
// - Location markers: Icons for locations (cities, dungeons, etc.)
// - Building indicators: Condition-colored building icons
//
// Both layers render SVG elements positioned on hex coordinates.
//
// CONSOLIDATED: Merged from location-marker-layer.ts, building-indicator-layer.ts

import type { App, TFile } from "obsidian";
import { normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { coordToKey, axialToCanvasPixel, hexWidth, hexHeight } from "@geometry";
import type { HexCoord } from "../../rendering/rendering-types";
import type { SimpleOverlayLayer, OverlayRenderData } from "../types";
import { LAYER_PRIORITY } from "../layer-registry";
import {
    getLocationInfluenceStore,
    type LocationInfluenceState,
    type LocationInfluenceEntry
} from "../../state/location-influence-store";
import type { LocationType } from "@services/domain";

const SVG_NS = "http://www.w3.org/2000/svg";

// =============================================================================
// SHARED HELPERS
// =============================================================================

/**
 * Normalize coordinate for consistent handling.
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

// =============================================================================
// LOCATION MARKER LAYER
// =============================================================================

const MARKER_FONT_SIZE = "24px";

/**
 * Icon mapping for location types.
 * Uses emoji for simplicity - can be replaced with SVG paths later.
 */
const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
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

/**
 * Location marker data from external sources
 */
interface LocationMarker {
    coord: HexCoord;
    locationName: string;
    locationType: LocationType;
    icon?: string; // Override icon (emoji or SVG path)
    parent?: string; // Parent location name
    ownerType?: "faction" | "npc" | "none";
    ownerName?: string;
}

/**
 * Internal location marker entry with resolved icon
 */
interface LocationMarkerEntry extends LocationMarker {
    key: string;
    displayIcon: string;
}

/**
 * Internal state for location marker layer
 */
interface LocationMarkerState {
    entries: Map<string, LocationMarkerEntry>;
}

/**
 * Create location marker layer
 *
 * Renders location icons (emoji or SVG) centered on hex coordinates.
 * Priority: LOCATION (above faction overlays)
 *
 * @example
 * ```typescript
 * const markerLayer = createLocationMarkerLayer(app, mapFile, radius, base, padding);
 * overlayManager.register(markerLayer);
 * ```
 */
export function createLocationMarkerLayer(
    app: App,
    mapFile: TFile,
    radius: number,
    base: HexCoord,
    padding: number
): SimpleOverlayLayer {
    const mapPath = normalizePath(mapFile.path);

    // Internal state - not exposed
    const state: WritableStore<LocationMarkerState> = writable({
        entries: new Map(),
    });

    // Cleanup functions collection
    const cleanups: Array<() => void> = [];

    // Helper to get pixel center from axial coordinate
    const centerOf = (coord: HexCoord): { cx: number; cy: number } => {
        const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
        return { cx: x, cy: y };
    };

    // Public API for updating layer data (used by external sources)
    const setMarkers = (markers: readonly LocationMarker[]) => {
        const nextEntries = new Map<string, LocationMarkerEntry>();
        const seen = new Set<string>();

        for (const marker of markers) {
            if (!marker) continue;

            const coord = normalizeCoord(marker.coord);
            if (!coord) continue;

            const locationName = normalizeString(marker.locationName);
            if (!locationName) continue;

            const key = coordToKey(coord);
            if (seen.has(key)) continue;

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
            entries: nextEntries,
        });
    };

    return {
        id: "location-marker",
        name: "Location Markers",
        priority: LAYER_PRIORITY.LOCATION,

        getCoordinates(): readonly HexCoord[] {
            const s = state.get();
            return Array.from(s.entries.values()).map(entry => entry.coord);
        },

        getRenderData(coord: HexCoord): OverlayRenderData | null {
            const s = state.get();
            const entry = s.entries.get(coordToKey(coord));
            if (!entry) return null;

            return {
                type: "svg",
                createElement: (coord: HexCoord) => {
                    const { cx, cy } = centerOf(coord);
                    const marker = document.createElementNS(SVG_NS, "text");
                    marker.setAttribute("class", "location-marker");
                    marker.setAttribute("text-anchor", "middle");
                    marker.setAttribute("pointer-events", "none");
                    marker.setAttribute("font-size", MARKER_FONT_SIZE);
                    marker.setAttribute("x", String(cx));
                    marker.setAttribute("y", String(cy - 10)); // Offset above center
                    marker.textContent = entry.displayIcon;

                    if (entry.locationName) {
                        const title = document.createElementNS(SVG_NS, "title");
                        title.textContent = entry.locationName;
                        marker.appendChild(title);
                    }

                    return marker;
                },
                updateElement: (element: SVGElement, coord: HexCoord) => {
                    const s = state.get();
                    const entry = s.entries.get(coordToKey(coord));
                    if (!entry) return;

                    // Update position and content
                    const { cx, cy } = centerOf(coord);
                    element.setAttribute("x", String(cx));
                    element.setAttribute("y", String(cy - 10));
                    element.textContent = entry.displayIcon;

                    // Update tooltip
                    const title = element.querySelector("title");
                    if (title) {
                        title.textContent = entry.locationName;
                    } else if (entry.locationName) {
                        const newTitle = document.createElementNS(SVG_NS, "title");
                        newTitle.textContent = entry.locationName;
                        element.appendChild(newTitle);
                    }
                },
                metadata: {
                    label: entry.locationName,
                    tooltip: entry.locationName,
                    locationType: entry.locationType,
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

// =============================================================================
// BUILDING INDICATOR LAYER
// =============================================================================

const ICON_SIZE = 16; // Small 16x16px icons

/**
 * Building condition thresholds for color coding
 */
const CONDITION_THRESHOLDS = {
    GOOD: 75,    // >= 75% = green
    WARNING: 50, // 50-75% = yellow
    // < 50% = red
} as const;

/**
 * Building condition color classes
 */
export type BuildingConditionClass = "good" | "warning" | "poor";

/**
 * Get condition class based on building condition percentage
 */
export function getBuildingConditionClass(condition: number): BuildingConditionClass {
    if (condition >= CONDITION_THRESHOLDS.GOOD) return "good";
    if (condition >= CONDITION_THRESHOLDS.WARNING) return "warning";
    return "poor";
}

/**
 * Create building indicator layer
 *
 * Renders small building icons on hexes with buildings, color-coded by condition.
 * Priority: BUILDING (above location markers, top-most UI overlay)
 *
 * @example
 * ```typescript
 * const buildingLayer = createBuildingIndicatorLayer(app, mapFile, radius, base, padding);
 * overlayManager.register(buildingLayer);
 * ```
 */
export function createBuildingIndicatorLayer(
    app: App,
    mapFile: TFile,
    radius: number,
    base: HexCoord,
    padding: number
): SimpleOverlayLayer {
    const store = getLocationInfluenceStore(app, mapFile);

    // Pre-compute hex dimensions
    const hexW = hexWidth(radius);
    const hexH = hexHeight(radius);

    // Helper to get pixel center from axial coordinate
    const centerOf = (coord: HexCoord): { cx: number; cy: number } => {
        const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
        return { cx: x, cy: y };
    };

    /**
     * Create building icon SVG element
     */
    const createBuildingIcon = (coord: HexCoord, conditionClass: BuildingConditionClass, condition: number): SVGGElement => {
        const { cx, cy } = centerOf(coord);
        const key = coordToKey(coord);

        // Container group
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("class", "sm-cartographer__building-icon");
        group.setAttribute("data-coord", key);
        group.setAttribute("data-condition", String(condition));

        // Position in bottom-right corner of hex
        const offsetX = hexW * 0.3;
        const offsetY = hexH * 0.25;
        group.setAttribute("transform", `translate(${cx + offsetX}, ${cy + offsetY})`);

        // Simple house icon using path
        const icon = document.createElementNS(SVG_NS, "path");
        icon.setAttribute("class", `sm-cartographer__building-icon-shape sm-cartographer__building-icon--${conditionClass}`);

        // House shape: roof triangle + square base
        // Scaled to fit in 16x16 box centered at (0,0)
        const iconPath = [
            "M 0 -6",     // Top of roof (peak)
            "L 6 -2",     // Right roof corner
            "L 6 6",      // Bottom-right
            "L -6 6",     // Bottom-left
            "L -6 -2",    // Left roof corner
            "Z",          // Close path
        ].join(" ");
        icon.setAttribute("d", iconPath);
        icon.setAttribute("stroke-width", "1");
        icon.setAttribute("stroke", "rgba(0,0,0,0.3)");

        // Add tooltip with condition info
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = `Building (${condition}% condition)`;

        group.appendChild(icon);
        group.appendChild(title);

        return group;
    };

    /**
     * Update existing building icon
     */
    const updateBuildingIcon = (element: SVGElement, coord: HexCoord) => {
        const entry = store.get(coord);
        if (!entry) return;

        const condition = entry.strength;
        const conditionClass = getBuildingConditionClass(condition);

        // Update condition class
        const shape = element.querySelector(".sm-cartographer__building-icon-shape");
        if (shape) {
            // Remove old condition classes
            shape.classList.remove(
                "sm-cartographer__building-icon--good",
                "sm-cartographer__building-icon--warning",
                "sm-cartographer__building-icon--poor"
            );
            // Add new condition class
            shape.classList.add(`sm-cartographer__building-icon--${conditionClass}`);
        }

        // Update tooltip
        const title = element.querySelector("title");
        if (title) {
            title.textContent = `Building (${condition}% condition)`;
        }

        element.setAttribute("data-condition", String(condition));
    };

    return {
        id: "building-indicator",
        name: "Building Indicators",
        priority: LAYER_PRIORITY.BUILDING,

        subscribe(callback: () => void): () => void {
            return store.state.subscribe(callback);
        },

        getRenderData(coord: HexCoord): OverlayRenderData | null {
            const entry = store.get(coord);
            if (!entry) return null;

            // Use strength as building condition for now
            // In production, this would come from building-specific data
            const condition = entry.strength;
            const conditionClass = getBuildingConditionClass(condition);

            return {
                type: "svg",
                createElement: (coord: HexCoord) => createBuildingIcon(coord, conditionClass, condition),
                updateElement: updateBuildingIcon,
                metadata: {
                    label: entry.locationName,
                    tooltip: `Building (${condition}% condition)`,
                    locationName: entry.locationName,
                    condition,
                    conditionClass,
                },
            };
        },

        getCoordinates(): readonly HexCoord[] {
            // Only show buildings (all location influence entries represent buildings for now)
            return store.list().map(entry => entry.coord);
        },

        destroy(): void {
            // Store cleanup handled by existing resetLocationInfluenceStore
        },
    };
}
