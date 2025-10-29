// src/workmodes/cartographer/editor/tools/location-marker/marker-panel.ts
// Location Marker Tool für den Map Editor - ermöglicht Platzierung von Location-Markern auf Hexes

import type { App, TFile } from "obsidian";
import type { RenderHandles } from "../../../../../features/maps/rendering/hex-render";
import type { HexOptions } from "../../../../../features/maps/domain/options";
import { LIBRARY_DATA_SOURCES } from "../../../../library/storage/data-sources";
import { enhanceSelectToSearch } from "../../../../../ui/components/search-dropdown";
import { logger } from "../../../../../app/plugin-logger";
import { saveTile, loadTile } from "../../../../../features/maps/data/tile-repository";
import { getLocationMarkerStore } from "../../../../../features/maps/state/location-marker-store";
import {
    buildForm,
    type FormSelectHandle,
    type FormHintHandle,
    type FormButtonHandle,
} from "../../../../../ui/components/form-builder";
import type { HexCoord } from "../../../controller";

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
    handleHexClick(coord: HexCoord): Promise<boolean>;
    setDisabled(disabled: boolean): void;
    destroy(): void;
};

type MarkerState = {
    selectedLocation: string; // Location name aus Library
    mode: "place" | "remove";
};

const TOOL_LABEL = "Location Marker";

export function mountLocationMarkerPanel(
    root: HTMLElement,
    ctx: LocationMarkerPanelContext
): LocationMarkerPanelControls {
    const state: MarkerState = {
        selectedLocation: "",
        mode: "place",
    };

    let disposed = false;
    let panelDisabled = false;
    let manageCommandAvailable = false;

    let locationControl: FormSelectHandle | null = null;
    let modeControl: FormSelectHandle | null = null;
    let manageButton: FormButtonHandle | null = null;
    let inlineHint: FormHintHandle | null = null;
    let manageHint: FormHintHandle | null = null;

    const setPanelDisabled = (disabled: boolean) => {
        panelDisabled = disabled;
        if (disabled) {
            root.classList.add("is-disabled");
        } else {
            root.classList.remove("is-disabled");
        }
        locationControl?.setDisabled(disabled);
        modeControl?.setDisabled(disabled);
        manageButton?.setDisabled(disabled || !manageCommandAvailable);
    };

    const updateStatus = (message: string) => {
        try {
            ctx.setStatus(message);
        } catch (err) {
            logger.error("[location-marker] failed to set status", err);
        }
    };

    type HintTone = "info" | "loading" | "error" | "warning";

    const setHint = (message: string, tone: HintTone = "info", element: FormHintHandle | null = null) => {
        const target = element ?? inlineHint;
        if (!target) return;
        target.set({ message, tone });
        target.setHidden(!message);
    };

    const clearHint = (element: FormHintHandle | null = null) => {
        const target = element ?? inlineHint;
        if (!target) return;
        target.setHidden(true);
    };

    const form = buildForm(root, {
        sections: [
            { kind: "header", text: "Location Marker" },
            { kind: "hint", id: "inline", cls: "sm-inline-hint", hidden: true },
            {
                kind: "row",
                label: "Location:",
                controls: [
                    {
                        kind: "select",
                        id: "location",
                        options: [{ label: "(none)", value: "" }],
                        enhance: (select) => enhanceSelectToSearch(select, "Search locations…"),
                        onChange: ({ element }) => {
                            state.selectedLocation = element.value;
                            clearHint();
                        },
                    },
                    {
                        kind: "button",
                        id: "manage",
                        label: "Manage…",
                    },
                ],
            },
            { kind: "hint", id: "manageHint", cls: "sm-inline-hint", hidden: true },
            {
                kind: "row",
                label: "Mode:",
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
                            if (state.mode === "place") {
                                updateStatus("Click hex to place location marker");
                            } else {
                                updateStatus("Click hex to remove location marker");
                            }
                        },
                    },
                ],
            },
        ],
    });

    locationControl = form.getControl("location") as FormSelectHandle | null;
    modeControl = form.getControl("mode") as FormSelectHandle | null;
    manageButton = form.getControl("manage") as FormButtonHandle | null;
    inlineHint = form.getHint("inline");
    manageHint = form.getHint("manageHint");

    // Check if manage command is available
    manageCommandAvailable = !!((ctx.app as any).commands?.commands?.[MANAGE_LOCATIONS_COMMAND_ID]);

    // Setup manage button
    if (manageButton) {
        manageButton.setDisabled(!manageCommandAvailable);
        manageButton.onClick(() => {
            if (manageCommandAvailable) {
                (ctx.app as any).commands.executeCommandById(MANAGE_LOCATIONS_COMMAND_ID);
            }
        });
    }

    // Load locations from Library
    const loadLocations = async () => {
        try {
            const locationFiles = await LIBRARY_DATA_SOURCES.locations.list(ctx.app);
            const locations: Array<{ name: string; type: string }> = [];

            for (const file of locationFiles) {
                try {
                    const entry = await LIBRARY_DATA_SOURCES.locations.load(ctx.app, file);
                    locations.push({
                        name: entry.name,
                        type: entry.locationType ?? "Unknown"
                    });
                } catch (err) {
                    logger.warn(`[location-marker] failed to load location ${file.path}`, err);
                }
            }

            // Sort alphabetically
            locations.sort((a, b) => a.name.localeCompare(b.name));

            locationControl?.setOptions([
                { label: "(none)", value: "" },
                ...locations.map((loc) => ({
                    label: `${loc.name} (${loc.type})`,
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
        } catch (err) {
            logger.error("[location-marker] failed to load locations", err);
            setHint("Failed to load locations from Library", "error");
        }
    };

    // Handle hex click
    const handleHexClick = async (coord: HexCoord): Promise<boolean> => {
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

                // Save with location marker
                await saveTile(ctx.app, file, coord, {
                    ...tileData,
                    locationMarker: state.selectedLocation,
                });

                // Update location marker store
                const markerStore = getLocationMarkerStore(ctx.app, file);
                const currentMarkers = markerStore.list();

                // Remove existing marker at this coord (if any)
                const filtered = currentMarkers.filter(m => m.coord.r !== coord.r || m.coord.c !== coord.c);

                // Add new marker
                filtered.push({
                    coord,
                    locationName: state.selectedLocation,
                    locationType: "Location", // Will be enriched by store
                });

                markerStore.setMarkers(filtered);

                updateStatus(`Placed marker: ${state.selectedLocation}`);
                clearHint();
                return true;
            } else if (state.mode === "remove") {
                // Load current tile data
                const tileData = await loadTile(ctx.app, file, coord);

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
                const filtered = currentMarkers.filter(m => m.coord.r !== coord.r || m.coord.c !== coord.c);
                markerStore.setMarkers(filtered);

                updateStatus("Removed location marker");
                clearHint();
                return true;
            }
        } catch (err) {
            logger.error("[location-marker] failed to handle hex click", err);
            setHint("Failed to update location marker", "error");
            return false;
        }

        return false;
    };

    // Initialize
    loadLocations().catch((err) => {
        logger.error("[location-marker] initialization failed", err);
    });

    return {
        activate() {
            if (state.mode === "place") {
                updateStatus("Click hex to place location marker");
            } else {
                updateStatus("Click hex to remove location marker");
            }
        },
        deactivate() {
            clearHint();
            updateStatus("");
        },
        onMapRendered() {
            // Reload locations when map changes
            loadLocations().catch((err) => {
                logger.error("[location-marker] onMapRendered loadLocations failed", err);
            });
        },
        handleHexClick,
        setDisabled: setPanelDisabled,
        destroy() {
            disposed = true;
            form.destroy();
            locationControl = null;
            modeControl = null;
            manageButton = null;
            inlineHint = null;
            manageHint = null;
        },
    };
}
