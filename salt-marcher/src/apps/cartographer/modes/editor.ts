import type { TFile } from "obsidian";
import type { CartographerMode, CartographerModeContext, HexCoord } from "../presenter";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import { createBrushTool } from "../editor/tools/terrain-brush/brush-options";
import type { ToolModule, ToolContext } from "../editor/tools/tools-api";
import type { RenderHandles } from "../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../core/options";

export function createEditorMode(): CartographerMode {
    let panel: HTMLElement | null = null;
    let fileLabel: HTMLElement | null = null;
    let toolSelect: HTMLSelectElement | null = null;
    let toolBody: HTMLElement | null = null;
    let statusLabel: HTMLElement | null = null;

    const tools: ToolModule[] = [createBrushTool()];

    let state: {
        file: TFile | null;
        handles: RenderHandles | null;
        options: HexOptions | null;
        tool: ToolModule | null;
        cleanupPanel: (() => void) | null;
    } = {
        file: null,
        handles: null,
        options: null,
        tool: null,
        cleanupPanel: null,
    };

    let toolCtx: ToolContext | null = null;

    const setStatus = (msg: string) => {
        if (!statusLabel) return;
        statusLabel.setText(msg ?? "");
        statusLabel.toggleClass("is-empty", !msg);
    };

    const updateFileLabel = () => {
        if (!fileLabel) return;
        fileLabel.textContent = state.file ? state.file.basename : "Keine Karte";
    };

    const updatePanelState = () => {
        const hasHandles = !!state.handles;
        panel?.toggleClass("is-disabled", !hasHandles);
        if (toolSelect) {
            toolSelect.disabled = !hasHandles;
        }
        if (!hasHandles) {
            setStatus(state.file ? "Karte wird geladen …" : "Keine Karte ausgewählt.");
        } else {
            setStatus("");
        }
    };

    const ensureToolCtx = (ctx: CartographerModeContext) => {
        toolCtx = {
            app: ctx.app,
            getFile: () => state.file,
            getHandles: () => state.handles,
            getOptions: () => state.options,
            setStatus,
        } satisfies ToolContext;
        return toolCtx;
    };

    const switchTool = async (id: string) => {
        if (!toolCtx || !toolBody || !toolSelect) return;
        if (state.tool?.onDeactivate) {
            try {
                state.tool.onDeactivate(toolCtx);
            } catch (err) {
                console.error("[editor-mode] tool onDeactivate failed", err);
            }
        }
        state.cleanupPanel?.();
        state.cleanupPanel = null;

        const next = tools.find((tool) => tool.id === id) ?? tools[0];
        state.tool = next;
        toolSelect.value = next.id;

        toolBody.empty();
        try {
            state.cleanupPanel = next.mountPanel(toolBody, toolCtx);
        } catch (err) {
            console.error("[editor-mode] mountPanel failed", err);
            state.cleanupPanel = null;
        }

        try {
            next.onActivate?.(toolCtx);
        } catch (err) {
            console.error("[editor-mode] onActivate failed", err);
        }

        if (state.handles) {
            try {
                next.onMapRendered?.(toolCtx);
            } catch (err) {
                console.error("[editor-mode] onMapRendered failed", err);
            }
        }
    };

    return {
        id: "editor",
        label: "Editor",
        async onEnter(ctx) {
            state = { ...state, tool: null };
            ctx.sidebarHost.empty();
            panel = ctx.sidebarHost.createDiv({ cls: "sm-cartographer__panel sm-cartographer__panel--editor" });
            panel.createEl("h3", { text: "Map Editor" });
            fileLabel = panel.createEl("div", { cls: "sm-cartographer__panel-file" });

            const toolsRow = panel.createDiv({ cls: "sm-cartographer__panel-tools" });
            toolsRow.createEl("label", { text: "Tool:" });
            toolSelect = toolsRow.createEl("select") as HTMLSelectElement;
            for (const tool of tools) {
                toolSelect.createEl("option", { value: tool.id, text: tool.label });
            }
            enhanceSelectToSearch(toolSelect, 'Such-dropdown…');
            toolSelect.onchange = () => {
                void switchTool(toolSelect?.value ?? tools[0].id);
            };

            toolBody = panel.createDiv({ cls: "sm-cartographer__panel-body" });
            statusLabel = panel.createDiv({ cls: "sm-cartographer__panel-status" });

            ensureToolCtx(ctx);
            updateFileLabel();
            updatePanelState();
            await switchTool(tools[0].id);
        },
        async onExit() {
            if (state.tool && toolCtx) {
                try {
                    state.tool.onDeactivate?.(toolCtx);
                } catch (err) {
                    console.error("[editor-mode] onDeactivate failed", err);
                }
            }
            state.cleanupPanel?.();
            state.cleanupPanel = null;
            state.tool = null;
            toolCtx = null;
            panel?.remove();
            panel = null;
            fileLabel = null;
            toolSelect = null;
            toolBody = null;
            statusLabel = null;
        },
        async onFileChange(file, handles, ctx) {
            state.file = file;
            state.handles = handles;
            state.options = ctx.getOptions();
            updateFileLabel();
            updatePanelState();
            if (!handles) return;
            if (!toolCtx) ensureToolCtx(ctx);
            try {
                state.tool?.onMapRendered?.(toolCtx!);
            } catch (err) {
                console.error("[editor-mode] onMapRendered failed", err);
            }
        },
        async onHexClick(coord: HexCoord) {
            if (!toolCtx || !state.tool?.onHexClick) return;
            try {
                await state.tool.onHexClick(coord, toolCtx);
            } catch (err) {
                console.error("[editor-mode] onHexClick failed", err);
            }
        },
    } satisfies CartographerMode;
}
