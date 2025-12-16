// src/workmodes/cartographer/editor/tools/location-marker/marker-panel.ts
// Location Marker Tool für den Map Editor - ermöglicht Platzierung von Location-Markern auf Hexes

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-location-marker");
import { coordToKey } from "@geometry";
import { calculateInfluenceArea, getInfluencedHexes } from "@features/locations/location-influence";
import { saveTile, loadTile, listTilesForMap } from "@features/maps/data/tile-repository";
import { ColorManager } from "@features/maps/config/color-manager";
import { createBorderManager, type BorderManagerHandle } from "@features/maps/rendering/core/borders";
import { getLocationMarkerStore } from "@features/maps";
import {
    buildForm,
    type FormSelectHandle,
    type FormHintHandle,
    type FormButtonHandle,
    type FormCheckboxHandle,
} from "@ui/components/form-builder";
import { enhanceSelectToSearch } from "@ui/components/search-dropdown";
import { LIBRARY_DATA_SOURCES } from "@services/orchestration";
import type { HexOptions } from "@features/maps/config/options";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { AxialCoord } from "../../../contracts/controller-interfaces";

const MANAGE_LOCATIONS_COMMAND_ID = "salt-marcher:open-library";

export type LocationMarkerPanelContext = {
    app: App;
    getFile(): TFile | null;
    getHandles(): RenderHandles | null;
    getOptions(): HexOptions | null;
    getAbortSignal(): AbortSignal | null;
    setStatus(message: string): void;
};

export type LocationMarkerPanelControls = {
    activate(): void;
    deactivate(): void;
    onMapRendered(): void;
    handleHexClick(coord: AxialCoord): Promise<boolean>;
    setDisabled(disabled: boolean): void;
    destroy(): void;
};

type MarkerState = {
    selectedLocation: string; // Location name aus Library
    mode: "place" | "remove";
    showInfluence: boolean; // Show faction influence borders
};

const TOOL_LABEL = "Location Marker";

export function mountLocationMarkerPanel(
    container: HTMLElement,
    ctx: LocationMarkerPanelContext
): LocationMarkerPanelControls {
    // Use container directly as root (no wrapper div)
    const root = container;
    root.classList.add("sm-cartographer__tool-panel", "is-disabled");

    const state: MarkerState = {
        selectedLocation: "",
        mode: "place",
        showInfluence: false, // Default: deactivated
    };

    let disposed = false;
    let panelDisabled = false;
    let manageCommandAvailable = false;
    let borderManager: BorderManagerHandle | null = null;
    const colorManager = new ColorManager(ctx.app);

    let locationControl: FormSelectHandle | null = null;
    let modeControl: FormSelectHandle | null = null;
    let manageButton: FormButtonHandle | null = null;
    let inlineHint: FormHintHandle | null = null;
    let manageHint: FormHintHandle | null = null;
    let showInfluenceCheckbox: FormCheckboxHandle | null = null;

    const setPanelDisabled = (disabled: boolean) => {
        panelDisabled = disabled;
        locationControl?.setDisabled(disabled);
        modeControl?.setDisabled(disabled);
        manageButton?.setDisabled(disabled || !manageCommandAvailable);
    };

    const updateStatus = (message: string) => {
        try {
            ctx.setStatus(message);
        } catch (err) {
            logger.error("failed to set status", err);
        }
    };

    type HintTone = "info" | "loading" | "error" | "warning";

    const setHint = (message: string, tone: HintTone = "info", element: FormHintHandle | null = null) => {
        const target = element ?? inlineHint;
        if (!target) return;
        if (message) {
            target.set({ message, tone });
        } else {
            target.set(null);
        }
    };

    const clearHint = (element: FormHintHandle | null = null) => {
        const target = element ?? inlineHint;
        if (!target) return;
        target.set(null);
    };

    // Store loaded locations for preview
    let cachedLocations: Array<{ name: string; type: string; icon?: string }> = [];

    const form = buildForm(root, {
        sections: [
            { kind: "header", text: "Location Marker" },
            { kind: "hint", id: "inline", cls: "sm-inline-hint", hidden: true },

            // Selection Section
            { kind: "static", id: "selectionHeader", cls: "sm-inspector-section__header" },
            {
                kind: "row",
                label: "Location:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "location",
                        options: [{ label: "(none)", value: "" }],
                        enhance: (select) => enhanceSelectToSearch(select, "Search locations…"),
                        onChange: ({ element }) => {
                            state.selectedLocation = element.value;
                            clearHint();
                            updatePreview();
                        },
                    },
                    {
                        kind: "button",
                        id: "manage",
                        label: "Manage…",
                        onClick: () => {
                            if (manageCommandAvailable) {
                                (ctx.app as any).commands.executeCommandById(MANAGE_LOCATIONS_COMMAND_ID);
                            }
                        },
                    },
                ],
            },
            { kind: "hint", id: "manageHint", cls: "sm-inline-hint", hidden: true },

            // Preview Section
            { kind: "separator" },
            { kind: "static", id: "previewHeader", cls: "sm-inspector-section__header" },
            { kind: "static", id: "previewBody", cls: "sm-inspector-section__body" },

            { kind: "separator" },

            // Mode Section
            { kind: "static", id: "modeHeader", cls: "sm-inspector-section__header" },
            {
                kind: "row",
                label: "Action:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "select",
                        id: "mode",
                        options: [
                            { label: "Place", value: "place" },
                            { label: "Remove", value: "remove" },
                        ],
                        value: "place",
                        onChange: ({ element }) => {
                            state.mode = element.value as "place" | "remove";
                            clearHint();
                            updateModeIndicator();
                            if (state.mode === "place") {
                                updateStatus("Click hex to place location marker");
                            } else {
                                updateStatus("Click hex to remove location marker");
                            }
                        },
                    },
                ],
            },
            { kind: "static", id: "modeIndicator", cls: "sm-mode-indicator" },

            { kind: "separator" },

            // Influence Section
            { kind: "static", id: "influenceHeader", cls: "sm-inspector-section__header" },
            {
                kind: "row",
                label: "Show Influence:",
                rowCls: "sm-cartographer__panel-row",
                controls: [
                    {
                        kind: "checkbox",
                        id: "showInfluence",
                        value: false,
                        onChange: async ({ element }) => {
                            state.showInfluence = element.checked;
                            if (state.showInfluence) {
                                await updateBorders();
                            } else {
                                borderManager?.clear();
                            }
                        },
                    },
                ],
            },

            // Help Section
            { kind: "separator" },
            { kind: "static", id: "helpSection", cls: "sm-inspector-section__body" },
        ],
    });

    locationControl = form.getControl("location") as FormSelectHandle | null;
    modeControl = form.getControl("mode") as FormSelectHandle | null;
    manageButton = form.getControl("manage") as FormButtonHandle | null;
    showInfluenceCheckbox = form.getControl("showInfluence") as FormCheckboxHandle | null;
    inlineHint = form.getHint("inline");
    manageHint = form.getHint("manageHint");

    // Initialize section headers
    const selectionHeader = form.getElement("selectionHeader");
    if (selectionHeader) {
        selectionHeader.createSpan({ cls: "sm-inspector-section__title", text: "Selection" });
    }

    const previewHeader = form.getElement("previewHeader");
    if (previewHeader) {
        previewHeader.createSpan({ cls: "sm-inspector-section__title", text: "Preview" });
    }

    const modeHeader = form.getElement("modeHeader");
    if (modeHeader) {
        modeHeader.createSpan({ cls: "sm-inspector-section__title", text: "Mode" });
    }

    const influenceHeader = form.getElement("influenceHeader");
    if (influenceHeader) {
        influenceHeader.createSpan({ cls: "sm-inspector-section__title", text: "Influence" });
    }

    // Get preview body, mode indicator, and help section containers
    const previewBody = form.getElement("previewBody");
    const modeIndicator = form.getElement("modeIndicator");
    const helpSection = form.getElement("helpSection");

    // Create help section content
    if (helpSection) {
        const helpCard = helpSection.createDiv({ cls: "sm-inspector-empty" });
        if (state.mode === "place") {
            helpCard.textContent = "Select a location above, then click on any hex to place a marker.";
        } else {
            helpCard.textContent = "Click on any hex with an existing marker to remove it.";
        }
    }

    // Preview update function
    const updatePreview = () => {
        if (!previewBody) return;

        previewBody.empty();

        if (!state.selectedLocation) {
            previewBody.createDiv({
                cls: "sm-inspector-empty",
                text: "No location selected"
            });
            return;
        }

        // Find location data from cache
        const locationData = cachedLocations.find(l => l.name === state.selectedLocation);
        if (!locationData) {
            previewBody.createDiv({
                cls: "sm-inspector-empty",
                text: "Location data not found"
            });
            return;
        }

        // Create location preview card
        const locationCard = previewBody.createDiv({ cls: "sm-inspector-location" });

        const locationHeader = locationCard.createDiv({ cls: "sm-location-header" });

        const locationIcon = locationHeader.createDiv({ cls: "sm-location-header__icon" });
        locationIcon.textContent = locationData.icon || "📍";

        const locationInfo = locationHeader.createDiv({ cls: "sm-location-header__info" });

        const locationName = locationInfo.createDiv({ cls: "sm-location-header__name" });
        locationName.textContent = locationData.name;

        const locationType = locationInfo.createDiv({ cls: "sm-location-header__type" });
        locationType.textContent = `Type: ${locationData.type}`;
    };

    // Mode indicator update function
    const updateModeIndicator = () => {
        if (!modeIndicator) return;

        modeIndicator.empty();
        modeIndicator.className = `sm-mode-indicator sm-mode-indicator--${state.mode}`;

        const icon = state.mode === "place" ? "📍" : "🗑️";
        const label = state.mode === "place" ? "Place" : "Remove";

        modeIndicator.createSpan({ text: icon });
        modeIndicator.createSpan({ text: label });

        // Update help section
        if (helpSection) {
            helpSection.empty();
            const helpCard = helpSection.createDiv({ cls: "sm-inspector-empty" });
            if (state.mode === "place") {
                helpCard.textContent = "Select a location above, then click on any hex to place a marker.";
            } else {
                helpCard.textContent = "Click on any hex with an existing marker to remove it.";
            }
        }
    };

    // Initial mode indicator
    updateModeIndicator();

    // Check if manage command is available
    manageCommandAvailable = !!((ctx.app as any).commands?.commands?.[MANAGE_LOCATIONS_COMMAND_ID]);

    // Setup manage button disabled state
    if (manageButton) {
        manageButton.setDisabled(!manageCommandAvailable);
    }

    // Load locations from Library
    const loadLocations = async () => {
        try {
            const locationFiles = await LIBRARY_DATA_SOURCES.locations.list(ctx.app);
            const locations: Array<{ name: string; type: string; icon?: string }> = [];

            for (const file of locationFiles) {
                try {
                    const entry = await LIBRARY_DATA_SOURCES.locations.load(ctx.app, file);
                    locations.push({
                        name: entry.name,
                        type: entry.locationType ?? "Unknown",
                        icon: entry.icon,
                    });
                } catch (err) {
                    logger.warn(`[location-marker] failed to load location ${file.path}`, err);
                }
            }

            // Sort alphabetically
            locations.sort((a, b) => a.name.localeCompare(b.name));

            // Cache locations for preview
            cachedLocations = locations;

            locationControl?.setOptions([
                { label: "(none)", value: "" },
                ...locations.map((loc) => ({
                    label: `${loc.icon || "📍"} ${loc.name} (${loc.type})`,
                    value: loc.name,
                })),
            ]);

            if (!manageCommandAvailable) {
                setHint(
                    "Library command not available. Cannot manage locations.",
                    "warning",
                    manageHint
                );
            }

            // Update preview after loading
            updatePreview();
        } catch (err) {
            logger.error("failed to load locations", err);
            setHint("Failed to load locations from Library", "error");
        }
    };

    // ==================== BORDER MANAGER ====================

    const ensureBorderManager = (handles: RenderHandles | null, options: HexOptions | null) => {
        if (!handles || !options) return;
        borderManager?.destroy();
        borderManager = createBorderManager({
            svg: handles.svg,
            contentG: handles.contentG,
            hexRadiusPx: options.hexPixelSize ?? 42,
            areaType: "faction", // Location influence uses faction borders
            base: handles.base,
            padding: handles.padding,
        });
    };

    // Color lookup function for location influence borders
    const getLocationInfluenceColor = async (locationName: string): Promise<string | undefined> => {
        try {
            const locationFiles = await LIBRARY_DATA_SOURCES.locations.list(ctx.app);
            const locationFile = locationFiles.find(f => f.basename === locationName);
            if (!locationFile) return undefined;

            const location = await LIBRARY_DATA_SOURCES.locations.load(ctx.app, locationFile);

            // If location has faction owner, use faction color (via ColorManager)
            if (location.owner_type === "faction" && location.owner_name) {
                const factionColor = await colorManager.getEntityColor("faction", location.owner_name);
                return factionColor;
            }

            // Fallback: use location icon color or default
            return location.color ?? "#4169E1"; // Royal blue default
        } catch (err) {
            logger.warn(`[location-marker] failed to load color for ${locationName}`, err);
            return undefined;
        }
    };

    const updateBorders = async () => {
        const file = ctx.getFile();
        if (!file || !borderManager) return;

        try {
            const tiles = await listTilesForMap(ctx.app, file);
            // Convert Array to Map<string, TileData> for border manager
            const tileMap = new Map(
                tiles.map(t => [coordToKey(t.coord), t.data])
            );
            await borderManager.update(tileMap, getLocationInfluenceColor);
        } catch (err) {
            logger.error("failed to update borders", err);
        }
    };

    // ==================== INFLUENCE VISUALIZATION ====================

    /**
     * Mark influenced hexes with faction data when placing a location marker
     */
    const updateLocationInfluence = async (locationName: string, markerCoord: AxialCoord): Promise<void> => {
        const file = ctx.getFile();
        if (!file) return;

        try {
            // Load location data
            const locationFiles = await LIBRARY_DATA_SOURCES.locations.list(ctx.app);
            const locationFile = locationFiles.find(f => f.basename === locationName);
            if (!locationFile) {
                logger.warn(`[location-marker] Location not found: ${locationName}`);
                return;
            }

            const location = await LIBRARY_DATA_SOURCES.locations.load(ctx.app, locationFile);

            // Calculate influence area
            const influenceArea = calculateInfluenceArea(location);
            if (!influenceArea) {
                logger.info(`[location-marker] No influence area for ${locationName}`);
                return;
            }

            // Get all influenced hexes
            const influencedHexes = getInfluencedHexes(influenceArea);

            // Mark each influenced hex with faction data (if location has faction owner)
            if (location.owner_type === "faction" && location.owner_name) {
                for (const { hex } of influencedHexes) {
                    // Convert cube coordinates to AxialCoord (odd-r)
                    // Axial to Odd-R: col = q + (r - (r & 1)) / 2, row = r
                    const col = hex.q + (hex.r - (hex.r & 1)) / 2;
                    const row = hex.r;
                    const hexCoord: AxialCoord = { q: hex.q, r: hex.r };

                    // Load existing tile data
                    const tileData = await loadTile(ctx.app, file, hexCoord);
                    if (!tileData) continue; // Skip hexes without tiles

                    // Save tile with faction field (for border visualization)
                    await saveTile(ctx.app, file, hexCoord, {
                        ...tileData,
                        faction: location.owner_name,
                    });
                }
            }

            // Update borders to visualize influence
            await updateBorders();

            logger.info(`[location-marker] Updated influence for ${locationName}: ${influencedHexes.length} hexes`);
        } catch (err) {
            logger.error(`[location-marker] Failed to update influence for ${locationName}`, err);
        }
    };

    /**
     * Remove faction data from influenced hexes when removing a location marker
     */
    const removeLocationInfluence = async (locationName: string, markerCoord: AxialCoord): Promise<void> => {
        const file = ctx.getFile();
        if (!file) return;

        try {
            // Load location data
            const locationFiles = await LIBRARY_DATA_SOURCES.locations.list(ctx.app);
            const locationFile = locationFiles.find(f => f.basename === locationName);
            if (!locationFile) {
                logger.warn(`[location-marker] Location not found: ${locationName}`);
                return;
            }

            const location = await LIBRARY_DATA_SOURCES.locations.load(ctx.app, locationFile);

            // Calculate influence area
            const influenceArea = calculateInfluenceArea(location);
            if (!influenceArea) {
                logger.info(`[location-marker] No influence area for ${locationName}`);
                return;
            }

            // Get all influenced hexes
            const influencedHexes = getInfluencedHexes(influenceArea);

            // Remove faction data from each influenced hex
            if (location.owner_type === "faction" && location.owner_name) {
                for (const { hex } of influencedHexes) {
                    // Convert cube coordinates to AxialCoord (odd-r)
                    // Axial to Odd-R: col = q + (r - (r & 1)) / 2, row = r
                    const col = hex.q + (hex.r - (hex.r & 1)) / 2;
                    const row = hex.r;
                    const hexCoord: AxialCoord = { q: hex.q, r: hex.r };

                    // Load existing tile data
                    const tileData = await loadTile(ctx.app, file, hexCoord);
                    if (!tileData) continue;

                    // Only remove faction if it matches this location's owner
                    if (tileData.faction === location.owner_name) {
                        await saveTile(ctx.app, file, hexCoord, {
                            ...tileData,
                            faction: undefined,
                        });
                    }
                }
            }

            // Update borders to reflect changes
            await updateBorders();

            logger.info(`[location-marker] Removed influence for ${locationName}: ${influencedHexes.length} hexes`);
        } catch (err) {
            logger.error(`[location-marker] Failed to remove influence for ${locationName}`, err);
        }
    };

    // Handle hex click
    const handleHexClick = async (coord: AxialCoord): Promise<boolean> => {
        if (disposed || panelDisabled) return false;

        const file = ctx.getFile();
        if (!file) {
            setHint("No map file selected", "error");
            return false;
        }

        const signal = ctx.getAbortSignal();
        if (signal?.aborted) return false;

        try {
            if (state.mode === "place") {
                if (!state.selectedLocation) {
                    setHint("Please select a location first", "warning");
                    return false;
                }

                // Load current tile data
                const tileData = await loadTile(ctx.app, file, coord);

                // Skip if no tile exists (Tile Brush creates tiles explicitly)
                if (!tileData) {
                    setHint("No tile exists at this hex (use Tile Brush to create)", "warning");
                    logger.info(`[location-marker] Skipping ${coord.q},${coord.r} - no tile exists`);
                    return false;
                }

                // Save with location marker
                await saveTile(ctx.app, file, coord, {
                    ...tileData,
                    locationMarker: state.selectedLocation,
                });

                // Update location marker store
                const markerStore = getLocationMarkerStore(ctx.app, file);
                const currentMarkers = markerStore.list();

                // Remove existing marker at this coord (if any)
                const filtered = currentMarkers.filter(m => m.coord.q !== coord.q || m.coord.r !== coord.r);

                // Add new marker
                filtered.push({
                    coord,
                    locationName: state.selectedLocation,
                    locationType: "Location", // Will be enriched by store
                });

                markerStore.setMarkers(filtered);

                // Update influence visualization if enabled
                if (state.showInfluence) {
                    await updateLocationInfluence(state.selectedLocation, coord);
                }

                updateStatus(`Placed marker: ${state.selectedLocation}`);
                clearHint();
                return true;
            } else if (state.mode === "remove") {
                // Load current tile data
                const tileData = await loadTile(ctx.app, file, coord);

                // Skip if no tile exists
                if (!tileData) {
                    setHint("No tile exists at this hex", "info");
                    logger.info(`[location-marker] Skipping ${coord.q},${coord.r} - no tile exists`);
                    return false;
                }

                if (!tileData.locationMarker) {
                    setHint("No location marker at this hex", "info");
                    return false;
                }

                // Save with location marker removed
                await saveTile(ctx.app, file, coord, {
                    ...tileData,
                    locationMarker: undefined,
                });

                // Update location marker store
                const markerStore = getLocationMarkerStore(ctx.app, file);
                const currentMarkers = markerStore.list();

                // Remove marker at this coord
                const filtered = currentMarkers.filter(m => m.coord.q !== coord.q || m.coord.r !== coord.r);
                markerStore.setMarkers(filtered);

                // Update influence visualization if enabled
                if (state.showInfluence && tileData.locationMarker) {
                    await removeLocationInfluence(tileData.locationMarker, coord);
                }

                updateStatus("Removed location marker");
                clearHint();
                return true;
            }
        } catch (err) {
            logger.error("failed to handle hex click", err);
            setHint("Failed to update location marker", "error");
            return false;
        }

        return false;
    };

    // Initialize
    loadLocations().catch((err) => {
        logger.error("initialization failed", err);
    });

    return {
        activate() {
            logger.info("activate() called - removing is-disabled", {
                beforeClasses: root.className
            });
            root.classList.remove("is-disabled");
            logger.info("activate() done", {
                afterClasses: root.className,
                hasDisabled: root.classList.contains("is-disabled")
            });
            if (state.mode === "place") {
                updateStatus("Click hex to place location marker");
            } else {
                updateStatus("Click hex to remove location marker");
            }
        },
        deactivate() {
            logger.info("deactivate() called - adding is-disabled", {
                beforeClasses: root.className
            });
            root.classList.add("is-disabled");
            logger.info("deactivate() done", {
                afterClasses: root.className,
                hasDisabled: root.classList.contains("is-disabled")
            });
            clearHint();
            updateStatus("");
        },
        onMapRendered() {
            // Initialize border manager
            const handles = ctx.getHandles();
            const options = ctx.getOptions();
            ensureBorderManager(handles, options);

            // Reload locations when map changes
            loadLocations().catch((err) => {
                logger.error("onMapRendered loadLocations failed", err);
            });

            // Update borders if influence is enabled
            if (state.showInfluence) {
                updateBorders().catch((err) => {
                    logger.error("onMapRendered updateBorders failed", err);
                });
            }
        },
        handleHexClick,
        setDisabled: setPanelDisabled,
        destroy() {
            disposed = true;
            borderManager?.destroy();
            borderManager = null;
            form.destroy();
            locationControl = null;
            modeControl = null;
            manageButton = null;
            showInfluenceCheckbox = null;
            inlineHint = null;
            manageHint = null;
        },
    };
}
