// src/workmodes/cartographer/view-builder.ts
// Factory function for creating the Cartographer view

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { createViewContainer } from "@ui/components/view-container";

const logger = configurableLogger.forModule("cartographer-view-builder");
import { createMapHeader, type MapHeaderHandle } from "@ui/maps/components/map-header";
import { createLayerControlPanel, type LayerControlPanelHandle } from "./components/layer-control-panel";
import { createToolToolbar } from "./components/tool-toolbar";
import { createTooltipRenderer } from "./components/tooltip-renderer";
import { createKeyboardHandler } from "./keyboard-handler";
import { TOOL_REGISTRY } from "./editor/tool-registry";
import type { CartographerViewHandle, CartographerControllerCallbacks } from "./cartographer-types";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { AxialCoord } from "./contracts/types";

/**
 * Options for building the Cartographer view
 */
export interface ViewBuilderOptions {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    callbacks: CartographerControllerCallbacks;

    // Keyboard action handlers
    keyboardActions: {
        getCurrentMode: () => string | null;
        getCurrentTool: () => string | null;
        switchMode: (modeId: string) => Promise<void>;
        switchTool: (toolId: string) => Promise<void>;
        toggleBrushMode: () => void;
        toggleToolMode: () => void;
        focusRegionDropdown: () => void;
        focusFactionDropdown: () => void;
        toggleLayerPanel: () => void;
        toggleWeatherLayer: () => void;
        toggleFactionLayer: () => void;
        applyLayerPreset: (presetId: string) => void;
        showHelp: () => void;
        undo: () => Promise<void>;
        redo: () => Promise<void>;
    };

    // Layer config change handlers
    onLayerConfigChange: (layerId: string, config: any) => void;
    onLayerConfigChangeBatch: (changes: Array<{ layerId: string; config: any }>) => void;

    // Toolbar tool selection handler
    onToolSelect: (toolId: string) => Promise<void>;
}

/**
 * Build the complete Cartographer view.
 * Creates header, sidebar, toolbar, layer panel, and keyboard handler.
 */
export function buildCartographerView(options: ViewBuilderOptions): CartographerViewHandle {
    const { app, host, initialFile, callbacks, keyboardActions, onLayerConfigChange, onLayerConfigChangeBatch, onToolSelect } = options;

    host.empty();

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const toolbarHost = host.createDiv({ cls: "sm-cartographer__toolbar-container" });
    const bodyHost = host.createDiv({ cls: "sm-cartographer__content" });

    // 3-column layout: left sidebar | canvas | right sidebar
    const leftSidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__layer-panel" });
    const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__canvas" });
    const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar-right" });

    const surface = createViewContainer(mapWrapper, { camera: false });

    // Create layer control panel (left sidebar)
    const layerPanel: LayerControlPanelHandle = createLayerControlPanel(app);
    layerPanel.mount(leftSidebarHost);

    // Wire up layer change callbacks
    layerPanel.onLayerChange((layerId, config) => {
        onLayerConfigChange(layerId, config);
    });

    // Wire up batch change callback (more efficient for group operations)
    layerPanel.onLayerChangeBatch((changes) => {
        onLayerConfigChangeBatch(changes);
    });

    // Create tooltip renderer
    const tooltip = createTooltipRenderer(app, surface.stageEl, initialFile);

    // Create tool toolbar (tools auto-populated from registry)
    const toolbar = createToolToolbar(app, toolbarHost, {
        tools: TOOL_REGISTRY.getAllTools(),
        initialTool: "tile-brush", // Default to tile brush (matches editor mode default)
        onToolSelect: async (toolId) => {
            logger.info("Tool selected", { toolId });
            await onToolSelect(toolId);
            toolbar.setActive(toolId);
        },
    });

    // Create keyboard handler
    const keyboardHandler = createKeyboardHandler(app, host, keyboardActions);

    // Create header
    const headerHandle: MapHeaderHandle = createMapHeader(app, headerHost, {
        title: "Cartographer",
        initialFile,
        onOpen: (file) => callbacks.onOpen(file),
        onCreate: (file) => callbacks.onCreate(file),
        onDelete: (file) => callbacks.onDelete(file),
        onSave: (mode, file) => callbacks.onSave(mode, file),
        // Mode selector removed - only one mode (Editor) remains
        // Inspector is now a persistent panel toggled via toolbar
    });

    // Track active tooltip listeners for cleanup
    let tooltipListeners: Array<{ polygon: SVGPolygonElement; enter: EventListener; leave: EventListener }> = [];

    function attachTooltipListeners(handles: RenderHandles, file: TFile) {
        // Clean up existing listeners
        for (const { polygon, enter, leave } of tooltipListeners) {
            polygon.removeEventListener("mouseenter", enter);
            polygon.removeEventListener("mouseleave", leave);
        }
        tooltipListeners = [];

        // Update tooltip file reference
        tooltip.setFile(file);

        // Attach new listeners to all polygons
        for (const [coordKey, polygon] of handles.polyByCoord.entries()) {
            const [r, c] = coordKey.split(",").map(Number);
            const coord = { r, c };

            const enterListener = ((ev: MouseEvent) => {
                tooltip.show(coord, ev.clientX, ev.clientY);
            }) as EventListener;

            const leaveListener = (() => {
                tooltip.hide();
            }) as EventListener;

            polygon.addEventListener("mouseenter", enterListener);
            polygon.addEventListener("mouseleave", leaveListener);

            tooltipListeners.push({
                polygon,
                enter: enterListener,
                leave: leaveListener,
            });
        }
    }

    const layerConfig = layerPanel.getLayerConfig();
    const categoryCount = layerConfig.filter(l => l.children && l.children.length > 0).length;
    logger.debug(`Layer panel: ${layerConfig.length} layers (${categoryCount} categories)`);

    return {
        mapHost: surface.stageEl,
        sidebarHost,
        leftSidebarHost,
        surface,
        layerPanel,
        keyboardHandler,
        toolbar,
        tooltip,
        setFileLabel: (file) => headerHandle.setFileLabel(file),
        setOverlay: (content) => surface.setOverlay(content),
        clearMap: () => surface.stageEl.empty(),
        attachTooltipListeners,
        destroy: () => {
            // Clean up tooltip listeners
            for (const { polygon, enter, leave } of tooltipListeners) {
                polygon.removeEventListener("mouseenter", enter);
                polygon.removeEventListener("mouseleave", leave);
            }
            tooltipListeners = [];

            tooltip.destroy();
            toolbar.destroy();
            keyboardHandler.destroy();
            layerPanel.destroy();
            headerHandle.destroy();
            surface.destroy();
            host.empty();
        },
    } satisfies CartographerViewHandle;
}
