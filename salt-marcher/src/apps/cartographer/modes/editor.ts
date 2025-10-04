// src/apps/cartographer/modes/editor.ts
// Hex-Editor mit direkter Brush-Integration ohne Tool-Manager.
import type { TFile } from "obsidian";
import type {
    CartographerMode,
    CartographerModeContext,
    CartographerModeLifecycleContext,
    HexCoord,
} from "../controller";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import { reportEditorToolIssue } from "../editor/editor-telemetry";
import {
    mountBrushPanel,
    type BrushPanelControls,
} from "../editor/tools/terrain-brush/brush-options";
import type { RenderHandles } from "../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../core/options";
import { createModeLifecycle } from "./lifecycle";

const BRUSH_LABEL = "Brush";

export function createEditorMode(): CartographerMode {
    let panel: HTMLElement | null = null;
    let fileLabel: HTMLElement | null = null;
    let statusLabel: HTMLElement | null = null;
    let toolBody: HTMLElement | null = null;

    let brush: BrushPanelControls | null = null;
    let brushActive = false;

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

    let baseStatus: PanelStatus = BASE_STATUS_NO_MAP;
    let contextualStatus: PanelStatus | null = null;
    let errorStatus: PanelStatus | null = null;

    const lifecycle = createModeLifecycle();

    const applyStatus = () => {
        if (!statusLabel) return;
        const status = errorStatus ?? contextualStatus ?? baseStatus;
        statusLabel.setText(status.message);
        statusLabel.toggleClass("is-empty", !status.message);
        statusLabel.toggleClass("is-error", status.tone === "error");
        statusLabel.toggleClass("is-loading", status.tone === "loading");
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

    const ensureBrush = (ctx: CartographerModeContext) => {
        if (brush) return brush;
        if (!toolBody) return null;
        try {
            brush = mountBrushPanel(toolBody, {
                app: ctx.app,
                getFile: () => state.file,
                getHandles: () => state.handles,
                getOptions: () => state.options,
                getAbortSignal: () => lifecycle.get(),
                setStatus: (message) => setContextualMessage(message),
            });
            brush.setDisabled(!state.handles || !!errorStatus);
            return brush;
        } catch (error) {
            const message = reportEditorToolIssue({
                stage: "mount-panel",
                toolId: BRUSH_LABEL,
                error,
            });
            setErrorStatus({ message, tone: "error" });
            return null;
        }
    };

    const refreshPanelState = () => {
        const hasHandles = !!state.handles;
        baseStatus = hasHandles ? BASE_STATUS_READY : state.file ? BASE_STATUS_LOADING : BASE_STATUS_NO_MAP;
        const toolsBlocked = !!errorStatus;
        panel?.toggleClass("is-disabled", !hasHandles || toolsBlocked);
        panel?.toggleClass("has-tool-error", toolsBlocked);
        brush?.setDisabled(!hasHandles || toolsBlocked);
        if (!brush || toolsBlocked || !hasHandles) {
            if (brushActive) {
                brush?.deactivate();
                brushActive = false;
            }
        } else if (!brushActive) {
            brush.activate();
            brushActive = true;
        }
        applyStatus();
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
            const toolSelect = toolsRow.createEl("select") as HTMLSelectElement;
            toolSelect.createEl("option", { value: "brush", text: BRUSH_LABEL });
            toolSelect.value = "brush";
            toolSelect.disabled = true;
            enhanceSelectToSearch(toolSelect, "Search dropdown…");

            toolBody = panel.createDiv({ cls: "sm-cartographer__panel-body" });
            statusLabel = panel.createDiv({ cls: "sm-cartographer__panel-status" });

            ensureBrush(ctx);

            updateFileLabel();
            refreshPanelState();
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            brush?.destroy();
            brush = null;
            brushActive = false;
            contextualStatus = null;
            errorStatus = null;
            baseStatus = BASE_STATUS_NO_MAP;
            panel?.remove();
            panel = null;
            fileLabel = null;
            statusLabel = null;
            toolBody = null;
            lifecycle.reset();
        },
        async onFileChange(file, handles, ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            state.file = file;
            state.handles = handles;
            state.options = ctx.getOptions();
            updateFileLabel();
            ensureBrush(ctx);
            refreshPanelState();
            if (!handles || isAborted()) return;
            brush?.onMapRendered();
        },
        async onHexClick(coord: HexCoord, _event, ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            if (isAborted()) return;
            const activeBrush = ensureBrush(ctx);
            if (!activeBrush) return;
            try {
                await activeBrush.handleHexClick(coord);
            } catch (err) {
                console.error("[editor-mode] brush interaction failed", err);
                const message = reportEditorToolIssue({
                    stage: "operation",
                    toolId: BRUSH_LABEL,
                    error: err,
                });
                setErrorStatus({ message, tone: "error" });
            }
        },
    } satisfies CartographerMode;
}
