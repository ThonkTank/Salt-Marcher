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
import { reportEditorToolIssue } from "../editor/editor-telemetry";
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

    type PanelStatusTone = "info" | "loading" | "error";
    type PanelStatus = { message: string; tone: PanelStatusTone };

    const BASE_STATUS_READY: PanelStatus = { message: "", tone: "info" };
    const BASE_STATUS_NO_MAP: PanelStatus = { message: "No map selected.", tone: "info" };
    const BASE_STATUS_LOADING: PanelStatus = { message: "Loading map…", tone: "loading" };

    let toolCtx: ToolContext | null = null;
    let baseStatus: PanelStatus = BASE_STATUS_NO_MAP;
    let contextualStatus: PanelStatus | null = null;
    let errorStatus: PanelStatus | null = null;

    const applyStatus = () => {
        if (!statusLabel) return;
        const status = errorStatus ?? contextualStatus ?? baseStatus;
        statusLabel.setText(status.message);
        statusLabel.toggleClass("is-empty", !status.message);
        statusLabel.toggleClass("is-error", status.tone === "error");
        statusLabel.toggleClass("is-loading", status.tone === "loading");
    };

    const refreshPanelState = () => {
        const hasHandles = !!state.handles;
        baseStatus = hasHandles ? BASE_STATUS_READY : state.file ? BASE_STATUS_LOADING : BASE_STATUS_NO_MAP;
        const toolsBlocked = !!errorStatus;
        panel?.toggleClass("is-disabled", !hasHandles || toolsBlocked);
        panel?.toggleClass("has-tool-error", toolsBlocked);
        if (toolSelect) {
            toolSelect.disabled = !hasHandles || toolsBlocked || tools.length === 0;
        }
        applyStatus();
    };

    const setContextualStatus = (status: PanelStatus | null) => {
        contextualStatus = status;
        refreshPanelState();
    };

    const setContextualMessage = (message: string, tone: PanelStatusTone = "info") => {
        setContextualStatus(message ? { message, tone } : null);
    };

    const setErrorStatus = (status: PanelStatus | null) => {
        errorStatus = status;
        if (status) {
            contextualStatus = null;
        }
        refreshPanelState();
    };

    const updateFileLabel = () => {
        if (!fileLabel) return;
        fileLabel.textContent = state.file ? state.file.basename : "No map";
    };

    const lifecycle = createModeLifecycle();

    const ensureToolCtx = (ctx: CartographerModeContext) => {
        toolCtx = {
            app: ctx.app,
            getFile: () => state.file,
            getHandles: () => state.handles,
            getOptions: () => state.options,
            getAbortSignal: () => lifecycle.get(),
            setStatus: (message) => {
                setContextualMessage(message);
            },
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
                const targetId = toolSelect?.value ?? tools[0]?.id;
                if (!targetId) return;
                const selected = tools.find((tool) => tool.id === targetId) ?? null;
                if (selected) {
                    setContextualMessage(`Loading "${selected.label}"…`, "loading");
                    setErrorStatus(null);
                }
                void manager.switchTo(targetId);
            };

            toolBody = panel.createDiv({ cls: "sm-cartographer__panel-body" });
            statusLabel = panel.createDiv({ cls: "sm-cartographer__panel-status" });

            ensureToolCtx(ctx);

            if (tools.length === 0) {
                const message = reportEditorToolIssue({
                    stage: "resolve",
                    toolId: "none",
                    error: new Error("No editor tools are registered"),
                });
                setErrorStatus({ message, tone: "error" });
            }

            manager = createToolManager(tools, {
                getContext: () => toolCtx,
                getPanelHost: () => toolBody,
                getLifecycleSignal: () => lifecycle.get(),
                onToolChanged: (tool) => {
                    if (!toolSelect) return;
                    toolSelect.value = tool?.id ?? "";
                    if (tool) {
                        setErrorStatus(null);
                        setContextualStatus(null);
                    }
                },
                onToolError: ({ stage, tool, error, toolId }) => {
                    const message = reportEditorToolIssue({
                        stage,
                        toolId: tool?.label ?? tool?.id ?? toolId,
                        error,
                    });
                    setErrorStatus({ message, tone: "error" });
                },
                onToolFallback: ({ stage, requestedId, fallback }) => {
                    const fallbackLabel = fallback?.label ?? fallback?.id ?? null;
                    if (!fallbackLabel) return;
                    const messagePrefix =
                        stage === "resolve"
                            ? `Tool "${requestedId}" is unavailable.`
                            : `Failed to load "${requestedId}".`;
                    setContextualStatus({
                        message: `${messagePrefix} Loading "${fallbackLabel}" instead…`,
                        tone: "loading",
                    });
                },
            });

            updateFileLabel();
            refreshPanelState();
            if (isAborted() || tools.length === 0) return;
            const defaultTool = tools[0];
            setContextualMessage(`Loading "${defaultTool.label}"…`, "loading");
            await manager.switchTo(defaultTool.id);
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            manager?.destroy();
            manager = null;
            toolCtx = null;
            contextualStatus = null;
            errorStatus = null;
            baseStatus = BASE_STATUS_NO_MAP;
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
            refreshPanelState();
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
