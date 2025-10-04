// src/apps/cartographer/modes/editor.ts
// Hex-Editor mit direkter Brush-Integration ohne Tool-Manager.
import type { TFile } from "obsidian";
import type {
    CartographerMode,
    CartographerModeContext,
    CartographerModeLifecycleContext,
    HexCoord,
} from "../controller";
import { reportEditorToolIssue } from "../editor/editor-telemetry";
import {
    mountBrushPanel,
    type BrushPanelControls,
} from "../editor/tools/terrain-brush/brush-options";
import type { RenderHandles } from "../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../core/options";
import { createModeLifecycle } from "./lifecycle";
import {
    buildForm,
    type FormBuilderInstance,
    type FormSelectHandle,
    type FormStatusHandle,
} from "../../../ui/form-builder";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";

const BRUSH_LABEL = "Brush";

export function createEditorMode(): CartographerMode {
    let panel: HTMLElement | null = null;
    let form: FormBuilderInstance<"file" | "toolSelect", never, "toolBody", "status"> | null = null;
    let fileLabel: HTMLElement | null = null;
    let statusField: FormStatusHandle | null = null;
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
        if (!statusField) return;
        const status = errorStatus ?? contextualStatus ?? baseStatus;
        statusField.set(status);
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
        panel?.classList.toggle("is-disabled", !hasHandles || toolsBlocked);
        panel?.classList.toggle("has-tool-error", toolsBlocked);
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

    const clearHost = (host: HTMLElement) => {
        while (host.firstChild) {
            host.removeChild(host.firstChild);
        }
    };

    return {
        id: "editor",
        label: "Editor",
        async onEnter(ctx: CartographerModeLifecycleContext) {
            lifecycle.bind(ctx);
            state = { ...state };
            clearHost(ctx.sidebarHost);
            panel = document.createElement("div");
            panel.className = "sm-cartographer__panel sm-cartographer__panel--editor";
            ctx.sidebarHost.appendChild(panel);

            form = buildForm(panel, {
                sections: [
                    { kind: "header", text: "Map Editor" },
                    { kind: "static", id: "file", cls: "sm-cartographer__panel-file" },
                    {
                        kind: "row",
                        label: "Tool:",
                        rowCls: "sm-cartographer__panel-tools",
                        controls: [
                            {
                                kind: "select",
                                id: "toolSelect",
                                options: [{ value: "brush", label: BRUSH_LABEL }],
                                value: "brush",
                                disabled: true,
                                enhance: (select) => enhanceSelectToSearch(select, "Search dropdown…"),
                            },
                        ],
                    },
                    { kind: "container", id: "toolBody", cls: "sm-cartographer__panel-body" },
                    { kind: "status", id: "status", cls: "sm-cartographer__panel-status" },
                ],
            });

            fileLabel = form.getElement("file");
            statusField = form.getStatus("status");
            toolBody = form.getContainer("toolBody");
            const toolSelectHandle = form.getControl("toolSelect") as FormSelectHandle | null;
            toolSelectHandle?.setValue("brush");
            toolSelectHandle?.setDisabled(true);

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
            form?.destroy();
            form = null;
            if (panel && panel.parentElement) {
                panel.parentElement.removeChild(panel);
            }
            panel = null;
            fileLabel = null;
            statusField = null;
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
