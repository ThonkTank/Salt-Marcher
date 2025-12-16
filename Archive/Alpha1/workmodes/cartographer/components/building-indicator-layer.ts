// src/workmodes/cartographer/components/building-indicator-layer.ts
// Building indicator layer for Cartographer UI
//
// Renders small SVG icons on hexes with buildings, color-coded by condition.
// Subscribes to location influence data and manages state internally.

import type { App, TFile } from "obsidian";
import { normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { coordToKey, axialToCanvasPixel } from "@geometry";
import type { AxialCoord } from "@features/maps/rendering/rendering-types";
import type { SimpleOverlayLayer, OverlayRenderData } from "@features/maps";
import { LAYER_PRIORITY } from "@features/maps";

const SVG_NS = "http://www.w3.org/2000/svg";
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
 * Building indicator data from external sources
 */
interface BuildingIndicator {
    coord: AxialCoord;
    condition: number; // 0-100
}

/**
 * Internal building indicator entry
 */
interface BuildingIndicatorEntry extends BuildingIndicator {
    key: string;
    conditionClass: BuildingConditionClass;
}

/**
 * Internal state for building indicator layer
 */
interface BuildingIndicatorState {
    entries: Map<string, BuildingIndicatorEntry>;
}

/**
 * Create building indicator layer
 *
 * Renders small building icons on hexes with buildings, color-coded by condition.
 * Uses SimpleOverlayLayer interface with SVG rendering.
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
    base: AxialCoord,
    padding: number
): SimpleOverlayLayer {
    const mapPath = normalizePath(mapFile.path);

    // Internal state - not exposed
    const state: WritableStore<BuildingIndicatorState> = writable({
        entries: new Map(),
    });

    // Cleanup functions collection
    const cleanups: Array<() => void> = [];

    // Calculate hex geometry (same as scene.ts and marker layer)
    const hexW = Math.sqrt(3) * radius;
    const hexH = 2 * radius;
    const hStep = hexW;
    const vStep = 0.75 * hexH;

    const centerOf = (coord: AxialCoord): { cx: number; cy: number } => {
        const { x, y } = axialToCanvasPixel(coord, radius, base, padding);
        return { cx: x, cy: y };
    };

    // Public API for updating layer data (used by external sources)
    const setIndicators = (indicators: readonly BuildingIndicator[]) => {
        const nextEntries = new Map<string, BuildingIndicatorEntry>();
        const seen = new Set<string>();

        for (const indicator of indicators) {
            if (!indicator) continue;

            const coord = normalizeCoord(indicator.coord);
            if (!coord) continue;

            const key = coordToKey(coord);
            if (seen.has(key)) continue;

            const conditionClass = getBuildingConditionClass(indicator.condition);

            const entry: BuildingIndicatorEntry = {
                ...indicator,
                coord,
                key,
                conditionClass,
            };

            nextEntries.set(key, entry);
            seen.add(key);
        }

        state.set({
            entries: nextEntries,
        });
    };

    // TODO: Subscribe to external location influence data sources
    // Example:
    // const influenceStore = getLocationInfluenceStore(app, mapFile);
    // const unsub = influenceStore.state.subscribe((influenceState) => {
    //     const indicators = convertInfluenceToBuildings(influenceState);
    //     setIndicators(indicators);
    // });
    // cleanups.push(unsub);

    /**
     * Create building icon SVG element
     */
    const createBuildingIcon = (coord: AxialCoord, conditionClass: BuildingConditionClass, condition: number): SVGGElement => {
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

    return {
        id: "building-indicator",
        name: "Building Indicators",
        priority: LAYER_PRIORITY.BUILDING, // Highest priority (on top)

        getCoordinates(): readonly AxialCoord[] {
            const s = state.get();
            return Array.from(s.entries.values()).map(entry => entry.coord);
        },

        getRenderData(coord: AxialCoord): OverlayRenderData | null {
            const s = state.get();
            const entry = s.entries.get(coordToKey(coord));
            if (!entry) return null;

            return {
                type: "svg",
                createElement: (coord: AxialCoord) => {
                    return createBuildingIcon(coord, entry.conditionClass, entry.condition);
                },
                updateElement: (element: SVGElement, coord: AxialCoord) => {
                    const s = state.get();
                    const entry = s.entries.get(coordToKey(coord));
                    if (!entry) return;

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
                        shape.classList.add(`sm-cartographer__building-icon--${entry.conditionClass}`);
                    }

                    // Update tooltip
                    const title = element.querySelector("title");
                    if (title) {
                        title.textContent = `Building (${entry.condition}% condition)`;
                    }

                    element.setAttribute("data-condition", String(entry.condition));
                },
                metadata: {
                    label: "Building",
                    tooltip: `Building (${entry.condition}% condition)`,
                    condition: entry.condition,
                    conditionClass: entry.conditionClass,
                },
            };
        },

        subscribe(callback: () => void): () => void {
            return state.subscribe(callback);
        },

        destroy(): void {
            // Cleanup all subscriptions
            cleanups.forEach(cleanup => cleanup());
        },
    };
}

// Helper functions
function normalizeCoord(coord: AxialCoord | undefined | null): AxialCoord | null {
    if (!coord) return null;
    const q = Number(coord.q);
    const r = Number(coord.r);
    if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
    return { q, r };
}
