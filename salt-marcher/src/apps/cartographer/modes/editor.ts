// src/apps/cartographer/modes/editor.ts
// Hex-Editor mit Tool-Manager für Karten.
import type { TFile } from "obsidian";
import type {
    CartographerMode,
    CartographerModeContext,
    CartographerModeLifecycleContext,
    HexCoord,
} from "../presenter";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import { createBrushTool } from "../editor/tools/terrain-brush/brush-options";
import { createToolManager } from "../editor/tools/tool-manager";
import type { ToolModule, ToolContext, ToolManager } from "../editor/tools/tools-api";
import type { RenderHandles } from "../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../core/options";
import { createModeLifecycle } from "./lifecycle";

export function createEditorMode(): CartographerMode {
    let panel: HTMLElement | null = null;
    let fileLabel: HTMLElement | null = null;
    let toolSelect: HTMLSelectElement | null = null;
    let toolBody: HTMLElement | null = null;
    let statusLabel: HTMLElement | null = null;

    const tools: ToolModule[] = [createBrushTool()];

    let manager: ToolManager | null = null;

    let state: {
        file: TFile | null;
        handles: RenderHandles | null;
        options: HexOptions | null;
    } = {
        file: null,
        handles: null,
        options: null,
    };

    let toolCtx: ToolContext | null = null;

    const setStatus = (msg: string) => {
        if (!statusLabel) return;
        statusLabel.setText(msg ?? "");
        statusLabel.toggleClass("is-empty", !msg);
    };

    const updateFileLabel = () => {
        if (!fileLabel) return;
        fileLabel.textContent = state.file ? state.file.basename : "No map";
    };

    const updatePanelState = () => {
        const hasHandles = !!state.handles;
        panel?.toggleClass("is-disabled", !hasHandles);
        if (toolSelect) {
            toolSelect.disabled = !hasHandles;
        }
        if (!hasHandles) {
            setStatus(state.file ? "Loading map…" : "No map selected.");
        } else {
            setStatus("");
        }
    };

    const lifecycle = createModeLifecycle();

    const ensureToolCtx = (ctx: CartographerModeContext) => {
        toolCtx = {
            app: ctx.app,
            getFile: () => state.file,
            getHandles: () => state.handles,
            getOptions: () => state.options,
            getAbortSignal: () => lifecycle.get(),
            setStatus,
        } satisfies ToolContext;
        return toolCtx;
    };

    const isAborted = () => lifecycle.isAborted();

    return {
        id: "editor",
        label: "Editor",
        async onEnter(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            state = { ...state };
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
            enhanceSelectToSearch(toolSelect, 'Search dropdown…');
            toolSelect.onchange = () => {
                if (isAborted() || !manager) return;
                const target = toolSelect?.value ?? tools[0].id;
                void manager.switchTo(target);
            };

            toolBody = panel.createDiv({ cls: "sm-cartographer__panel-body" });
            statusLabel = panel.createDiv({ cls: "sm-cartographer__panel-status" });

            ensureToolCtx(ctx);

            manager = createToolManager(tools, {
                getContext: () => toolCtx,
                getPanelHost: () => toolBody,
                getLifecycleSignal: () => lifecycle.get(),
                onToolChanged: (tool) => {
                    if (!toolSelect) return;
                    toolSelect.value = tool?.id ?? "";
                },
            });

            updateFileLabel();
            updatePanelState();
            if (isAborted()) return;
            await manager.switchTo(tools[0].id);
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            manager?.destroy();
            manager = null;
            toolCtx = null;
            panel?.remove();
            panel = null;
            fileLabel = null;
            toolSelect = null;
            toolBody = null;
            statusLabel = null;
            lifecycle.reset();
        },
        async onFileChange(file, handles, ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            state.file = file;
            state.handles = handles;
            state.options = ctx.getOptions();
            updateFileLabel();
            updatePanelState();
            if (!handles) return;
            if (!toolCtx) ensureToolCtx(ctx);
            if (isAborted()) return;
            manager?.notifyMapRendered();
        },
        async onHexClick(coord: HexCoord, _event, ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            if (isAborted()) return;
            const active = manager?.getActive();
            if (!toolCtx || !active?.onHexClick) return;
            try {
                await active.onHexClick(coord, toolCtx);
            } catch (err) {
                console.error("[editor-mode] onHexClick failed", err);
            }
        },
    } satisfies CartographerMode;
}
