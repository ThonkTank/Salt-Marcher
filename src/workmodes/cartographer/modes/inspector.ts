// src/workmodes/cartographer/modes/inspector.ts
// Hex-Inspector zur Bearbeitung einzelner Tiles.
import type { TFile } from "obsidian";
import { loadTile, saveTile } from "../../../features/maps/data/tile-repository";
import { TERRAIN_COLORS } from "../../../features/maps/domain/terrain";
import { loadRegions } from "../../../features/maps/data/region-repository";
import { LIBRARY_DATA_SOURCES } from "../../library/storage/data-sources";
import { enhanceSelectToSearch } from "../../../ui/components/search-dropdown";
import type { RenderHandles } from "../../../features/maps/rendering/hex-render";
import { logger } from "../../../app/plugin-logger";
import type {
    CartographerMode,
    CartographerModeLifecycleContext,
    HexCoord,
} from "../controller";
import { createModeLifecycle } from "./lifecycle";
import {
    buildForm,
    type FormBuilderInstance,
    type FormSelectHandle,
    type FormStatusHandle,
    type FormTextareaHandle,
} from "../../../ui/components/form-builder";
import { getLocationMarkerStore } from "../../../features/maps/state/location-marker-store";
import { VIEW_LIBRARY } from "../../library/view";
import { getLocationInfluenceStore } from "../../../features/maps/state/location-influence-store";
import { readFrontmatter } from "../../../features/data-manager/browse/frontmatter-utils";
import type { LocationData } from "../../library/locations/types";
import { isBuildingLocation } from "../../library/locations/types";
import { BUILDING_TEMPLATES } from "../../../features/locations/building-production";
import { BuildingManagementModal } from "../building-management-modal";

type InspectorUI = {
    panel: HTMLElement | null;
    form: FormBuilderInstance<"file" | "terrain" | "region" | "faction" | "note" | "location", never, never, "message"> | null;
    fileLabel: HTMLElement | null;
    message: FormStatusHandle | null;
    terrain: FormSelectHandle | null;
    region: FormSelectHandle | null;
    faction: FormSelectHandle | null;
    note: FormTextareaHandle | null;
    locationInfo: HTMLElement | null;
};

type InspectorState = {
    file: TFile | null;
    handles: RenderHandles | null;
    selection: HexCoord | null;
    saveTimer: number | null;
};

export function createInspectorMode(): CartographerMode {
    let ui: InspectorUI = {
        panel: null,
        form: null,
        fileLabel: null,
        message: null,
        terrain: null,
        region: null,
        faction: null,
        note: null,
    };

    let state: InspectorState = {
        file: null,
        handles: null,
        selection: null,
        saveTimer: null,
    };

    const lifecycle = createModeLifecycle();

    const isAborted = () => lifecycle.isAborted();

    const clearSaveTimer = () => {
        if (state.saveTimer !== null) {
            window.clearTimeout(state.saveTimer);
            state.saveTimer = null;
        }
    };

    const resetInputs = () => {
        ui.terrain?.setValue("");
        ui.terrain?.setDisabled(true);
        ui.region?.setValue("");
        ui.region?.setDisabled(true);
        ui.faction?.setValue("");
        ui.faction?.setDisabled(true);
        ui.note?.setValue("");
        ui.note?.setDisabled(true);
    };

    const updateMessage = () => {
        if (!ui.message) return;
        if (!state.file || !state.handles) {
            ui.message.set({ message: state.file ? "Karte wird geladen …" : "Keine Karte ausgewählt.", tone: "info" });
        } else if (!state.selection) {
            ui.message.set({ message: "Hex anklicken, um Terrain & Notiz zu bearbeiten.", tone: "info" });
        } else {
            ui.message.set({ message: `Hex r${state.selection.r}, c${state.selection.c}`, tone: "info" });
        }
    };

    const updateFileLabel = () => {
        if (!ui.fileLabel) return;
        ui.fileLabel.textContent = state.file ? state.file.basename : "Keine Karte";
    };

    const updatePanelState = () => {
        const hasMap = !!state.file && !!state.handles;
        ui.panel?.classList.toggle("is-disabled", !hasMap);
        if (!hasMap) {
            state.selection = null;
            resetInputs();
        }
        updateMessage();
    };

    const scheduleSave = (ctx: CartographerModeLifecycleContext) => {
        if (ctx.signal.aborted) return;
        if (!state.selection) return;
        const file = ctx.getFile();
        if (!file) return;
        const handles = ctx.getRenderHandles();
        clearSaveTimer();
        state.saveTimer = window.setTimeout(async () => {
            if (ctx.signal.aborted) return;
            const terrain = ui.terrain?.getValue() ?? "";
            const region = ui.region?.getValue() ?? "";
            const faction = ui.faction?.getValue() ?? "";
            const note = ui.note?.getValue() ?? "";
            try {
                await saveTile(ctx.app, file, state.selection!, { terrain, region, faction, note });
            } catch (err) {
                logger.error("[inspector-mode] saveTile failed", err);
            }
            const color = TERRAIN_COLORS[terrain] ?? "transparent";
            try {
                handles?.setFill(state.selection!, color);
            } catch (err) {
                logger.error("[inspector-mode] setFill failed", err);
            }
        }, 250);
    };

    const loadSelection = async (ctx: CartographerModeLifecycleContext) => {
        if (!state.selection) return;
        const file = ctx.getFile();
        if (!file) return;
        let data: Awaited<ReturnType<typeof loadTile>> | null = null;
        try {
            data = await loadTile(ctx.app, file, state.selection);
        } catch (err) {
            logger.error("[inspector-mode] loadTile failed", err);
            data = null;
        }
        if (ctx.signal.aborted) return;
        ui.terrain?.setValue(data?.terrain ?? "");
        ui.terrain?.setDisabled(false);
        ui.region?.setValue(data?.region ?? "");
        ui.region?.setDisabled(false);
        ui.faction?.setValue(data?.faction ?? "");
        ui.faction?.setDisabled(false);
        ui.note?.setValue(data?.note ?? "");
        ui.note?.setDisabled(false);

        // Load location marker info (Phase 9.1 enhanced)
        if (ui.locationInfo) {
            // Clear existing content
            while (ui.locationInfo.firstChild) {
                ui.locationInfo.removeChild(ui.locationInfo.firstChild);
            }

            const markerStore = getLocationMarkerStore(ctx.app, file);
            const marker = markerStore.get(state.selection);

            // Also check for location influence at this hex
            const influenceStore = getLocationInfluenceStore(ctx.app, file);
            const influence = influenceStore.get(state.selection);

            if (marker || influence) {
                const header = ui.locationInfo.createEl("h4", { text: "📍 Location Info" });
                header.style.marginTop = "0";
                header.style.marginBottom = "8px";

                // Display marker info if present
                if (marker) {
                    const infoDiv = ui.locationInfo.createDiv({ cls: "sm-location-marker-info" });
                    infoDiv.createDiv({ text: `${marker.displayIcon} ${marker.locationName}`, cls: "sm-location-name" });
                    infoDiv.createDiv({ text: `Type: ${marker.locationType}`, cls: "sm-location-type" });

                    if (marker.parent) {
                        infoDiv.createDiv({ text: `Parent: ${marker.parent}`, cls: "sm-location-parent" });
                    }

                    if (marker.ownerName) {
                        const ownerLabel = marker.ownerType === "faction" ? "Faction" : marker.ownerType === "npc" ? "Owner (NPC)" : "Owner";
                        infoDiv.createDiv({ text: `${ownerLabel}: ${marker.ownerName}`, cls: "sm-location-owner" });
                    }

                    const openBtn = ui.locationInfo.createEl("button", { text: "Open in Library" });
                    openBtn.style.marginTop = "8px";
                    openBtn.addEventListener("click", async () => {
                        const leaf = ctx.app.workspace.getLeaf(false);
                        await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
                        ctx.app.workspace.revealLeaf(leaf);
                        // TODO: Navigate to specific location and open it
                    });
                }

                // Display influence info if present (Phase 9.1)
                if (influence) {
                    const influenceDiv = ui.locationInfo.createDiv({ cls: "sm-location-influence-info" });
                    influenceDiv.style.marginTop = marker ? "12px" : "0";
                    influenceDiv.style.padding = "8px";
                    influenceDiv.style.background = "var(--background-secondary)";
                    influenceDiv.style.borderRadius = "4px";

                    const influenceHeader = influenceDiv.createEl("div", {
                        text: `Influence Area: ${influence.locationName}`,
                        cls: "sm-influence-header"
                    });
                    influenceHeader.style.fontWeight = "600";
                    influenceHeader.style.marginBottom = "4px";

                    influenceDiv.createDiv({
                        text: `Strength: ${Math.round(influence.strength)}%`,
                        cls: "sm-influence-strength"
                    });

                    if (influence.ownerName) {
                        const ownerLabel = influence.ownerType === "faction" ? "Faction" : influence.ownerType === "npc" ? "NPC" : "Owner";
                        influenceDiv.createDiv({
                            text: `${ownerLabel}: ${influence.ownerName}`,
                            cls: "sm-influence-owner"
                        });
                    }

                    // Phase 9.1.2: Load and display building/worker information
                    const locationPath = `SaltMarcher/Locations/${influence.locationName}.md`;
                    const locationFile = lifecycle.ctx?.app.vault.getAbstractFileByPath(locationPath);

                    if (locationFile && 'extension' in locationFile) {
                        // Async load location data - wrap in try/catch to avoid breaking UI
                        (async () => {
                            try {
                                const fm = await readFrontmatter(lifecycle.ctx!.app, locationFile as TFile);
                                const locationData = fm as unknown as LocationData;

                                if (isBuildingLocation(locationData)) {
                                    const prod = locationData.building_production;
                                    const template = BUILDING_TEMPLATES[prod.buildingType];

                                    if (template) {
                                        const buildingDiv = influenceDiv.createDiv({ cls: "sm-building-details" });
                                        buildingDiv.style.marginTop = "8px";
                                        buildingDiv.style.paddingTop = "8px";
                                        buildingDiv.style.borderTop = "1px solid var(--background-modifier-border)";

                                        const buildingHeader = buildingDiv.createEl("div", {
                                            text: "Building Details",
                                            cls: "sm-building-header"
                                        });
                                        buildingHeader.style.fontWeight = "600";
                                        buildingHeader.style.marginBottom = "4px";

                                        // Building type and condition
                                        const conditionIcon = prod.condition >= 80 ? "🟢" : prod.condition >= 40 ? "🟡" : "🔴";
                                        buildingDiv.createDiv({
                                            text: `${conditionIcon} ${template.name} (${prod.condition}% condition)`,
                                            cls: "sm-building-type"
                                        });

                                        // Workers
                                        buildingDiv.createDiv({
                                            text: `Workers: ${prod.currentWorkers}/${template.maxWorkers}`,
                                            cls: "sm-building-workers"
                                        });

                                        // Maintenance status
                                        if (prod.maintenanceOverdue > 0) {
                                            const maintenanceDiv = buildingDiv.createDiv({
                                                text: `⚠️ Maintenance overdue: ${prod.maintenanceOverdue} days`,
                                                cls: "sm-building-maintenance"
                                            });
                                            maintenanceDiv.style.color = "var(--text-warning)";
                                        }

                                        // Active jobs
                                        if (prod.activeJobs && prod.activeJobs.length > 0) {
                                            const jobsDiv = buildingDiv.createDiv({ cls: "sm-building-jobs" });
                                            jobsDiv.style.marginTop = "4px";
                                            jobsDiv.createEl("div", {
                                                text: `Active Jobs: ${prod.activeJobs.length}`,
                                                cls: "sm-jobs-header"
                                            }).style.fontSize = "0.9em";
                                        }

                                        // Manage Building button (Phase 9.2B)
                                        const manageButton = buildingDiv.createEl("button", {
                                            text: "Manage Building",
                                            cls: "sm-manage-building-btn"
                                        });
                                        manageButton.style.marginTop = "8px";
                                        manageButton.style.width = "100%";
                                        manageButton.onclick = () => {
                                            const modal = new BuildingManagementModal(lifecycle.ctx!.app, {
                                                locationFile: locationFile as TFile,
                                                locationData,
                                                onSave: (updatedData) => {
                                                    // Refresh the inspector panel with updated data
                                                    logger.info('[cartographer:inspector] Building updated, refreshing display');
                                                    // The inspection will be re-triggered by the next hex selection
                                                }
                                            });
                                            modal.open();
                                        };
                                    }
                                }
                            } catch (error) {
                                logger.warn('[cartographer:inspector] Failed to load building details', {
                                    locationName: influence.locationName,
                                    error
                                });
                            }
                        })();
                    }
                }
            }
        }

        updateMessage();
    };

    const clearHost = (host: HTMLElement) => {
        while (host.firstChild) {
            host.removeChild(host.firstChild);
        }
    };

    return {
        id: "inspector",
        label: "Inspector",
        async onEnter(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            ui = { panel: null, form: null, fileLabel: null, message: null, terrain: null, region: null, faction: null, note: null, locationInfo: null };
            state = { ...state, selection: null };

            clearHost(ctx.sidebarHost);
            ui.panel = document.createElement("div");
            ui.panel.className = "sm-cartographer__panel sm-cartographer__panel--inspector";
            ctx.sidebarHost.appendChild(ui.panel);

            ui.form = buildForm(ui.panel, {
                sections: [
                    { kind: "header", text: "Inspektor" },
                    { kind: "static", id: "file", cls: "sm-cartographer__panel-file" },
                    { kind: "status", id: "message", cls: "sm-cartographer__panel-info" },
                    {
                        kind: "row",
                        label: "Terrain:",
                        rowCls: "sm-cartographer__panel-row",
                        controls: [
                            {
                                kind: "select",
                                id: "terrain",
                                options: Object.keys(TERRAIN_COLORS).map((key) => ({
                                    value: key,
                                    label: key || "(leer)",
                                })),
                                disabled: true,
                                enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                                onChange: () => scheduleSave(ctx),
                            },
                        ],
                    },
                    {
                        kind: "row",
                        label: "Region:",
                        rowCls: "sm-cartographer__panel-row",
                        controls: [
                            {
                                kind: "select",
                                id: "region",
                                options: [],
                                disabled: true,
                                enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                                onChange: () => scheduleSave(ctx),
                            },
                        ],
                    },
                    {
                        kind: "row",
                        label: "Faction:",
                        rowCls: "sm-cartographer__panel-row",
                        controls: [
                            {
                                kind: "select",
                                id: "faction",
                                options: [],
                                disabled: true,
                                enhance: (select) => enhanceSelectToSearch(select, "Such-dropdown…"),
                                onChange: () => scheduleSave(ctx),
                            },
                        ],
                    },
                    {
                        kind: "row",
                        label: "Notiz:",
                        rowCls: "sm-cartographer__panel-row",
                        controls: [
                            {
                                kind: "textarea",
                                id: "note",
                                rows: 6,
                                disabled: true,
                                onInput: () => scheduleSave(ctx),
                            },
                        ],
                    },
                    { kind: "separator" },
                    { kind: "static", id: "location", cls: "sm-cartographer__location-info" },
                ],
            });

            ui.fileLabel = ui.form.getElement("file");
            ui.message = ui.form.getStatus("message");
            ui.terrain = ui.form.getControl("terrain") as FormSelectHandle | null;
            ui.region = ui.form.getControl("region") as FormSelectHandle | null;
            ui.faction = ui.form.getControl("faction") as FormSelectHandle | null;
            ui.note = ui.form.getControl("note") as FormTextareaHandle | null;
            ui.locationInfo = ui.form.getElement("location");

            // Load region options
            try {
                const regions = await loadRegions(ctx.app);
                ui.region?.setOptions([
                    { label: "(none)", value: "" },
                    ...regions.map((r) => ({
                        label: r.name || "(unnamed)",
                        value: r.name ?? "",
                    })),
                ]);
            } catch (err) {
                logger.error("[inspector-mode] failed to load regions", err);
            }

            // Load faction options
            try {
                const factionFiles = await LIBRARY_DATA_SOURCES.factions.list(ctx.app);
                const factions: Array<{ name: string }> = [];
                for (const file of factionFiles) {
                    try {
                        const entry = await LIBRARY_DATA_SOURCES.factions.load(ctx.app, file);
                        factions.push({ name: entry.name });
                    } catch (err) {
                        logger.warn(`[inspector-mode] failed to load faction ${file.path}`, err);
                    }
                }
                ui.faction?.setOptions([
                    { label: "(none)", value: "" },
                    ...factions.map((f) => ({
                        label: f.name || "(unnamed)",
                        value: f.name ?? "",
                    })),
                ]);
            } catch (err) {
                logger.error("[inspector-mode] failed to load factions", err);
            }

            updateFileLabel();
            updatePanelState();
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            clearSaveTimer();
            ui.form?.destroy();
            ui.panel?.remove();
            ui = { panel: null, form: null, fileLabel: null, message: null, terrain: null, region: null, faction: null, note: null, locationInfo: null };
            state = { file: null, handles: null, selection: null, saveTimer: null };
            lifecycle.reset();
        },
        async onFileChange(file, handles, ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            state.file = file;
            state.handles = handles;
            clearSaveTimer();
            resetInputs();
            updateFileLabel();
            updatePanelState();
            if (state.selection && state.file && state.handles && !isAborted()) {
                await loadSelection(ctx);
            }
        },
        async onHexClick(coord, _event, ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            if (isAborted()) return;
            if (!state.file || !state.handles) return;
            clearSaveTimer();
            state.selection = coord;
            updateMessage();
            if (isAborted()) return;
            await loadSelection(ctx);
        },
    } satisfies CartographerMode;
}
