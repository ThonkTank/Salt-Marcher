// src/apps/cartographer/modes/inspector.ts
// Hex-Inspector zur Bearbeitung einzelner Tiles.
import type { TFile } from "obsidian";
import { loadTile, saveTile } from "../../../core/hex-mapper/hex-notes";
import { TERRAIN_COLORS } from "../../../core/terrain";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import type { RenderHandles } from "../../../core/hex-mapper/hex-render";
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
} from "../../../ui/form-builder";

type InspectorUI = {
    panel: HTMLElement | null;
    form: FormBuilderInstance<"file" | "terrain" | "note", never, never, "message"> | null;
    fileLabel: HTMLElement | null;
    message: FormStatusHandle | null;
    terrain: FormSelectHandle | null;
    note: FormTextareaHandle | null;
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
            const note = ui.note?.getValue() ?? "";
            try {
                await saveTile(ctx.app, file, state.selection!, { terrain, note });
            } catch (err) {
                console.error("[inspector-mode] saveTile failed", err);
            }
            const color = TERRAIN_COLORS[terrain] ?? "transparent";
            try {
                handles?.setFill(state.selection!, color);
            } catch (err) {
                console.error("[inspector-mode] setFill failed", err);
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
            console.error("[inspector-mode] loadTile failed", err);
            data = null;
        }
        if (ctx.signal.aborted) return;
        ui.terrain?.setValue(data?.terrain ?? "");
        ui.terrain?.setDisabled(false);
        ui.note?.setValue(data?.note ?? "");
        ui.note?.setDisabled(false);
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
            ui = { panel: null, form: null, fileLabel: null, message: null, terrain: null, note: null };
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
                ],
            });

            ui.fileLabel = ui.form.getElement("file");
            ui.message = ui.form.getStatus("message");
            ui.terrain = ui.form.getControl("terrain") as FormSelectHandle | null;
            ui.note = ui.form.getControl("note") as FormTextareaHandle | null;

            updateFileLabel();
            updatePanelState();
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            clearSaveTimer();
            ui.form?.destroy();
            ui.panel?.remove();
            ui = { panel: null, form: null, fileLabel: null, message: null, terrain: null, note: null };
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
