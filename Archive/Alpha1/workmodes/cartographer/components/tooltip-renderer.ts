// src/workmodes/cartographer/components/tooltip-renderer.ts
// Hover tooltip renderer for hex tiles - shows terrain, region, faction, and location data

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { readFrontmatter } from "@features/data-manager/browse/frontmatter-utils";

const logger = configurableLogger.forModule("cartographer-tooltip");
import { BUILDING_TEMPLATES } from "@features/locations/building-production";
import { loadTile } from "@features/maps/data/tile-repository";
import { getLocationInfluenceStore, getLocationMarkerStore } from "@features/maps";
import { isBuildingLocation } from "@features/locations";
import type { LocationData } from "../../library/locations/location-types";
import type { AxialCoord } from "../contracts/contract-types";

export type TooltipHandle = {
    show(coord: AxialCoord, clientX: number, clientY: number): void;
    hide(): void;
    setFile(file: TFile | null): void;
    destroy(): void;
};

type TooltipState = {
    app: App;
    container: HTMLElement;
    tooltip: HTMLElement;
    file: TFile | null;
    currentCoord: AxialCoord | null;
    visible: boolean;
    loadAbort: AbortController | null;
};

const TOOLTIP_OFFSET_X = 15;
const TOOLTIP_OFFSET_Y = 15;
const TOOLTIP_EDGE_MARGIN = 20;

/**
 * Create a tooltip renderer for hex hover events
 */
export function createTooltipRenderer(app: App, container: HTMLElement, file: TFile | null): TooltipHandle {
    // Create tooltip element
    const tooltip = container.createDiv({ cls: "sm-cartographer__tooltip" });
    tooltip.style.display = "none";

    const state: TooltipState = {
        app,
        container,
        tooltip,
        file,
        currentCoord: null,
        visible: false,
        loadAbort: null,
    };

    function show(coord: AxialCoord, clientX: number, clientY: number) {
        // Cancel any pending load
        if (state.loadAbort) {
            state.loadAbort.abort();
            state.loadAbort = null;
        }

        // Start loading data
        state.currentCoord = coord;
        state.visible = true;

        // Show loading state immediately
        tooltip.empty();
        tooltip.createDiv({ text: "Loading...", cls: "sm-cartographer__tooltip-loading" });
        positionTooltip(clientX, clientY);
        tooltip.style.display = "block";
        tooltip.addClass("sm-cartographer__tooltip--visible");

        // Load data asynchronously
        const abortController = new AbortController();
        state.loadAbort = abortController;

        void loadTooltipData(coord, abortController.signal)
            .then((data) => {
                if (abortController.signal.aborted) return;
                if (state.currentCoord?.q !== coord.q || state.currentCoord?.r !== coord.r) return;

                renderTooltipContent(data);
                positionTooltip(clientX, clientY);
            })
            .catch((error) => {
                if (abortController.signal.aborted) return;
                logger.error("failed to load tooltip data", error);
                tooltip.empty();
                tooltip.createDiv({ text: "Error loading data", cls: "sm-cartographer__tooltip-error" });
            });
    }

    function hide() {
        state.visible = false;
        state.currentCoord = null;

        if (state.loadAbort) {
            state.loadAbort.abort();
            state.loadAbort = null;
        }

        tooltip.removeClass("sm-cartographer__tooltip--visible");
        // Wait for fade-out animation before hiding
        setTimeout(() => {
            if (!state.visible) {
                tooltip.style.display = "none";
            }
        }, 150);
    }

    function positionTooltip(clientX: number, clientY: number) {
        const rect = tooltip.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        let x = clientX + TOOLTIP_OFFSET_X;
        let y = clientY + TOOLTIP_OFFSET_Y;

        // Flip horizontally if too close to right edge
        if (x + rect.width + TOOLTIP_EDGE_MARGIN > containerRect.right) {
            x = clientX - rect.width - TOOLTIP_OFFSET_X;
        }

        // Flip vertically if too close to bottom edge
        if (y + rect.height + TOOLTIP_EDGE_MARGIN > containerRect.bottom) {
            y = clientY - rect.height - TOOLTIP_OFFSET_Y;
        }

        // Convert to container-relative coordinates
        const containerX = x - containerRect.left;
        const containerY = y - containerRect.top;

        tooltip.style.left = `${containerX}px`;
        tooltip.style.top = `${containerY}px`;
    }

    async function loadTooltipData(coord: AxialCoord, signal: AbortSignal): Promise<TooltipData> {
        if (!state.file) {
            return {
                coord,
                terrain: null,
                region: null,
                faction: null,
                marker: null,
                influence: null,
            };
        }

        // Load tile data
        const tileData = await loadTile(app, state.file, coord);
        if (signal.aborted) throw new Error("Aborted");

        // Handle null tile data (unpainted hex)
        if (!tileData) {
            // Load marker data even for unpainted hexes
            const markerStore = getLocationMarkerStore(app, state.file);
            const marker = markerStore.get(coord);

            // Load influence data
            const influenceStore = getLocationInfluenceStore(app, state.file);
            const influence = influenceStore.get(coord);

            // Load building data if applicable
            let buildingData: BuildingTooltipData | null = null;
            if (influence && influence.locationPath) {
                const locationFile = app.vault.getAbstractFileByPath(influence.locationPath);
                if (locationFile instanceof TFile) {
                    const locationData = await readFrontmatter<LocationData>(app, locationFile);
                    if (signal.aborted) throw new Error("Aborted");

                    if (isBuildingLocation(locationData) && locationData.building) {
                        const building = locationData.building;
                        const template = BUILDING_TEMPLATES[building.type];

                        if (template) {
                            buildingData = {
                                type: building.type,
                                typeName: template.name,
                                condition: building.condition,
                                currentWorkers: building.currentWorkers,
                                maxWorkers: template.maxWorkers,
                                maintenanceOverdue: building.maintenanceOverdue,
                            };
                        }
                    }
                }
            }

            return {
                coord,
                terrain: null,
                region: null,
                faction: null,
                marker: marker
                    ? {
                          name: marker.locationName,
                          icon: marker.displayIcon,
                          type: marker.locationType,
                      }
                    : null,
                influence: influence
                    ? {
                          locationName: influence.locationName,
                          ownerName: influence.ownerName,
                          strength: influence.strength,
                          building: buildingData,
                      }
                    : null,
            };
        }

        // Load marker data
        const markerStore = getLocationMarkerStore(app, state.file);
        const marker = markerStore.get(coord);

        // Load influence data
        const influenceStore = getLocationInfluenceStore(app, state.file);
        const influence = influenceStore.get(coord);

        // Load building data if applicable
        let buildingData: BuildingTooltipData | null = null;
        if (influence && influence.locationPath) {
            const locationFile = app.vault.getAbstractFileByPath(influence.locationPath);
            if (locationFile instanceof TFile) {
                const locationData = await readFrontmatter<LocationData>(app, locationFile);
                if (signal.aborted) throw new Error("Aborted");

                if (isBuildingLocation(locationData) && locationData.building) {
                    const building = locationData.building;
                    const template = BUILDING_TEMPLATES[building.type];

                    if (template) {
                        buildingData = {
                            type: building.type,
                            typeName: template.name,
                            condition: building.condition,
                            currentWorkers: building.currentWorkers,
                            maxWorkers: template.maxWorkers,
                            maintenanceOverdue: building.maintenanceOverdue,
                        };
                    }
                }
            }
        }

        return {
            coord,
            terrain: tileData.terrain || null,
            region: tileData.region || null,
            faction: tileData.faction || null,
            marker: marker
                ? {
                      name: marker.locationName,
                      icon: marker.displayIcon,
                      type: marker.locationType,
                  }
                : null,
            influence: influence
                ? {
                      locationName: influence.locationName,
                      ownerName: influence.ownerName,
                      strength: influence.strength,
                      building: buildingData,
                  }
                : null,
        };
    }

    function renderTooltipContent(data: TooltipData) {
        tooltip.empty();

        const content = tooltip.createDiv({ cls: "sm-cartographer__tooltip-content" });

        // Terrain (always show)
        const terrainEl = content.createDiv({ cls: "sm-cartographer__tooltip-terrain" });
        terrainEl.textContent = data.terrain || "Unknown Terrain";

        // Region (if assigned)
        if (data.region) {
            const regionEl = content.createDiv({ cls: "sm-cartographer__tooltip-row" });
            regionEl.createSpan({ text: "Region: ", cls: "sm-cartographer__tooltip-label" });
            regionEl.createSpan({ text: data.region, cls: "sm-cartographer__tooltip-value" });
        }

        // Faction (if assigned)
        if (data.faction) {
            const factionEl = content.createDiv({ cls: "sm-cartographer__tooltip-row" });
            factionEl.createSpan({ text: "Faction: ", cls: "sm-cartographer__tooltip-label" });
            factionEl.createSpan({ text: data.faction, cls: "sm-cartographer__tooltip-value" });
        }

        // Location marker (if present)
        if (data.marker) {
            content.createDiv({ cls: "sm-cartographer__tooltip-separator" });

            const markerEl = content.createDiv({ cls: "sm-cartographer__tooltip-location" });
            const nameRow = markerEl.createDiv({ cls: "sm-cartographer__tooltip-location-name" });
            nameRow.createSpan({ text: data.marker.icon, cls: "sm-cartographer__tooltip-location-icon" });
            nameRow.createSpan({ text: data.marker.name, cls: "sm-cartographer__tooltip-location-text" });

            if (data.marker.type) {
                const typeRow = markerEl.createDiv({ cls: "sm-cartographer__tooltip-row" });
                typeRow.createSpan({ text: `(${data.marker.type})`, cls: "sm-cartographer__tooltip-muted" });
            }
        }

        // Building details (if present)
        if (data.influence?.building) {
            const building = data.influence.building;

            const conditionEl = content.createDiv({ cls: "sm-cartographer__tooltip-row" });
            conditionEl.createSpan({ text: "Condition: ", cls: "sm-cartographer__tooltip-label" });

            const conditionValue = conditionEl.createSpan({ cls: "sm-cartographer__tooltip-value" });
            conditionValue.textContent = `${building.condition}%`;

            // Add condition indicator
            if (building.condition < 50) {
                conditionValue.createSpan({ text: " ⚠️", cls: "sm-cartographer__tooltip-warning" });
            } else if (building.condition < 75) {
                conditionValue.createSpan({ text: " ⚡", cls: "sm-cartographer__tooltip-caution" });
            }

            // Workers
            const workersEl = content.createDiv({ cls: "sm-cartographer__tooltip-row" });
            workersEl.createSpan({ text: "Workers: ", cls: "sm-cartographer__tooltip-label" });
            workersEl.createSpan({
                text: `${building.currentWorkers}/${building.maxWorkers}`,
                cls: "sm-cartographer__tooltip-value",
            });

            // Maintenance warning
            if (building.maintenanceOverdue > 0) {
                const maintenanceEl = content.createDiv({ cls: "sm-cartographer__tooltip-warning-row" });
                maintenanceEl.textContent = `⚠️ Maintenance ${building.maintenanceOverdue} days overdue`;
            }
        }
    }

    function setFile(file: TFile | null) {
        state.file = file;
    }

    function destroy() {
        if (state.loadAbort) {
            state.loadAbort.abort();
            state.loadAbort = null;
        }
        tooltip.remove();
    }

    return {
        show,
        hide,
        setFile,
        destroy,
    };
}

// Types

type TooltipData = {
    coord: AxialCoord;
    terrain: string | null;
    region: string | null;
    faction: string | null;
    marker: {
        name: string;
        icon: string;
        type: string;
    } | null;
    influence: {
        locationName: string;
        ownerName: string | undefined;
        strength: number;
        building: BuildingTooltipData | null;
    } | null;
};

type BuildingTooltipData = {
    type: string;
    typeName: string;
    condition: number;
    currentWorkers: number;
    maxWorkers: number;
    maintenanceOverdue: number;
};
