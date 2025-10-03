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
} from "../presenter";
import { createModeLifecycle } from "./lifecycle";

type InspectorUI = {
    panel: HTMLElement | null;
    fileLabel: HTMLElement | null;
    message: HTMLElement | null;
    terrain: HTMLSelectElement | null;
    note: HTMLTextAreaElement | null;
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
        if (ui.terrain) {
            ui.terrain.value = "";
            ui.terrain.disabled = true;
        }
        if (ui.note) {
            ui.note.value = "";
            ui.note.disabled = true;
        }
    };

    const updateMessage = () => {
        if (!ui.message) return;
        if (!state.file || !state.handles) {
            ui.message.setText(state.file ? "Karte wird geladen …" : "Keine Karte ausgewählt.");
        } else if (!state.selection) {
            ui.message.setText("Hex anklicken, um Terrain & Notiz zu bearbeiten.");
        } else {
            ui.message.setText(`Hex r${state.selection.r}, c${state.selection.c}`);
        }
    };

    const updateFileLabel = () => {
        if (!ui.fileLabel) return;
        ui.fileLabel.textContent = state.file ? state.file.basename : "Keine Karte";
    };

    const updatePanelState = () => {
        const hasMap = !!state.file && !!state.handles;
        ui.panel?.toggleClass("is-disabled", !hasMap);
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
            const terrain = ui.terrain?.value ?? "";
            const note = ui.note?.value ?? "";
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
        if (ui.terrain) {
            ui.terrain.value = data?.terrain ?? "";
            ui.terrain.disabled = false;
        }
        if (ui.note) {
            ui.note.value = data?.note ?? "";
            ui.note.disabled = false;
        }
        updateMessage();
    };

    return {
        id: "inspector",
        label: "Inspector",
        async onEnter(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            ui = { panel: null, fileLabel: null, message: null, terrain: null, note: null };
            state = { ...state, selection: null };

            ctx.sidebarHost.empty();
            ui.panel = ctx.sidebarHost.createDiv({ cls: "sm-cartographer__panel sm-cartographer__panel--inspector" });
            ui.panel.createEl("h3", { text: "Inspektor" });
            ui.fileLabel = ui.panel.createEl("div", { cls: "sm-cartographer__panel-file" });

            const messageRow = ui.panel.createEl("div", { cls: "sm-cartographer__panel-info" });
            ui.message = messageRow;

            const terrRow = ui.panel.createDiv({ cls: "sm-cartographer__panel-row" });
            terrRow.createEl("label", { text: "Terrain:" });
            ui.terrain = terrRow.createEl("select") as HTMLSelectElement;
            for (const key of Object.keys(TERRAIN_COLORS)) {
                const opt = ui.terrain.createEl("option", { text: key || "(leer)" }) as HTMLOptionElement;
                opt.value = key;
            }
            enhanceSelectToSearch(ui.terrain, 'Such-dropdown…');
            ui.terrain.disabled = true;
            ui.terrain.onchange = () => scheduleSave(ctx);

            const noteRow = ui.panel.createDiv({ cls: "sm-cartographer__panel-row" });
            noteRow.createEl("label", { text: "Notiz:" });
            ui.note = noteRow.createEl("textarea", { attr: { rows: "6" } }) as HTMLTextAreaElement;
            ui.note.disabled = true;
            ui.note.oninput = () => scheduleSave(ctx);

            updateFileLabel();
            updatePanelState();
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            clearSaveTimer();
            ui.panel?.remove();
            ui = { panel: null, fileLabel: null, message: null, terrain: null, note: null };
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
