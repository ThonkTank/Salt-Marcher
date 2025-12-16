// src/workmodes/cartographer/cartographer-controller.ts
// Controller: Simplified cartographer lifecycle with direct editor integration.

import { Notice, type App, type TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { parseOptions, type HexOptions } from "@features/maps/config/options";

const logger = configurableLogger.forModule("cartographer-controller");
import { type MapHeaderSaveMode } from "@ui/maps/components/map-header";
import { getFirstHexBlock } from "@ui/maps/components/map-list";
import { createMapManager, type MapManagerHandle } from "@ui/maps/workflows/map-manager";
import { createMapLayer, type MapLayer } from "../session-runner/travel/ui/map-layer";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { AxialCoord } from "./contracts/types";
import {
    type CartographerControllerCallbacks,
    type CartographerViewHandle,
    type CartographerControllerDeps,
    type CartographerControllerInterface,
} from "./cartographer-types";
import {
    createCartographerStore,
    actions,
    type CartographerStore,
} from "./store";
// ElevationLayerManager merged into LayerManager (Wave 4.D2)
import { CartographerKeyboardShortcutsHelpModal } from "./cartographer-keyboard-shortcuts-help";
import { loadMap, initializeMapSystems, LayerManager } from "./services";
import { getMapSession } from "@features/maps/session";
import { UndoManager } from "@features/maps";
import { LifecycleManager } from "@services/app-lifecycle-manager";
import { ToolPanelManager } from "./editor/tool-panel-manager";
import type { ExtendedToolContext } from "./contracts/controller-interfaces";
import { buildCartographerView } from "./view-builder";

// Import tool registrations (ensures tools are registered before toolbar creation)
import "./editor/tools/tile-brush/index";
import "./editor/tools/terrain-brush/index";
import "./editor/tools/location-marker/index";
import "./editor/tools/feature-brush/feature-brush-registration";
import "./editor/tools/inspector/index";
import "./editor/tools/area-brush/index";
import "./editor/tools/climate-brush/index";
import "./editor/tools/gradient-brush/index";
import "./editor/tools/derived-layers/index";

// Re-export types for backward compatibility
export type { CartographerControllerCallbacks };

const createDefaultDeps = (app: App): CartographerControllerDeps => ({
    createMapManager: (appInstance, options) => createMapManager(appInstance, options),
    createMapLayer: (appInstance, host, file, opts) => createMapLayer(appInstance, host, file, opts),
    loadHexOptions: async (appInstance, file) => {
        const block = await getFirstHexBlock(appInstance, file);
        return block ? parseOptions(block) : null;
    },
});

export class CartographerController implements CartographerControllerInterface {
    private readonly app: App;
    private readonly deps: CartographerControllerDeps;
    readonly callbacks: CartographerControllerCallbacks;

    private view: CartographerViewHandle | null = null;
    private host: HTMLElement | null = null;
    private mapManager: MapManagerHandle | null = null;
    private currentFile: TFile | null = null;
    private requestedFile: TFile | null = null;
    private currentOptions: HexOptions | null = null;
    private mapLayer: MapLayer | null = null;
    private isMounted = false;

    // Editor tool panel management (integrated directly)
    private toolManager: ToolPanelManager | null = null;
    private toolBody: HTMLElement | null = null;
    private editorUndoManager: UndoManager | null = null;

    private abortController: AbortController | null = null;
    private renderAbort?: AbortController;

    // Layer management (includes elevation visualization since Wave 4.D2)
    private layerManager: LayerManager | null = null;

    // Guided setup flag - true when a new map was just created
    private isGuidedSetupActive = false;

    // Unified state store (Phase 2)
    private store: CartographerStore | null = null;

    // Lifecycle management for centralized cleanup (LIFO order)
    private readonly lifecycle = new LifecycleManager();

    constructor(app: App, deps: Partial<CartographerControllerDeps> = {}) {
        this.app = app;
        const defaults = createDefaultDeps(app);
        this.deps = {
            ...defaults,
            ...deps,
        };

        this.callbacks = {
            onModeSelect: (_id, _ctx) => Promise.resolve(), // No-op: mode system removed
            onOpen: (file) => this.mapManager?.setFile(file),
            onCreate: (file) => {
                this.isGuidedSetupActive = true; // Start guided setup for new maps
                // Force panel recreation so "Weiter →" button becomes visible
                this.toolManager?.destroyPanel("gradient-brush");
                this.toolManager?.switchTo("gradient-brush");
                this.mapManager?.setFile(file);
            },
            onDelete: () => this.mapManager?.deleteCurrent(),
            onSave: (mode, file) => this.handleSave(mode, file),
            onHexClick: (coord, event) => this.handleHexClick(coord, event),
        } satisfies CartographerControllerCallbacks;
    }

    async onOpen(host: HTMLElement, fallbackFile: TFile | null): Promise<void> {
        await this.onClose();

        this.host = host;
        this.isMounted = true;
        const initialFile = this.requestedFile ?? fallbackFile ?? null;
        this.currentFile = initialFile;
        this.requestedFile = initialFile;

        // Build view using factory function
        const view = buildCartographerView({
            app: this.app,
            host,
            initialFile,
            callbacks: this.callbacks,
            keyboardActions: {
                getCurrentMode: () => this.getCurrentMode(),
                getCurrentTool: () => this.getCurrentTool(),
                switchMode: (_id) => Promise.resolve(), // No-op: only one mode now
                switchTool: (id) => this.switchTool(id),
                toggleBrushMode: () => this.toggleBrushMode(),
                toggleToolMode: () => this.toggleToolMode(),
                focusRegionDropdown: () => this.focusRegionDropdown(),
                focusFactionDropdown: () => this.focusFactionDropdown(),
                toggleLayerPanel: () => this.toggleLayerPanel(),
                toggleWeatherLayer: () => this.toggleLayer('weather'),
                toggleFactionLayer: () => this.toggleLayer('faction-overlay'),
                applyLayerPreset: (presetId) => this.applyLayerPreset(presetId),
                showHelp: () => this.showHelp(),
                undo: () => this.undo(),
                redo: () => this.redo(),
            },
            onLayerConfigChange: (layerId, config) => this.layerManager?.handleConfigChange(layerId, config),
            onLayerConfigChangeBatch: (changes) => this.layerManager?.handleConfigChangeBatch(changes),
            onToolSelect: async (toolId) => {
                await this.toolManager?.switchTo(toolId);
            },
        });
        this.view = view;

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.applyCurrentFile(file);
            },
        });

        view.setFileLabel(initialFile);

        // Initialize LayerManager (register cleanup with lifecycle)
        this.layerManager = new LayerManager({
            app: this.app,
            plugin: this.deps.plugin,
            getLayerPanel: () => this.view?.layerPanel ?? null,
            getHandles: () => this.mapLayer?.handles ?? null,
        });
        this.lifecycle.add(() => {
            this.layerManager?.destroy();
            this.layerManager = null;
        });
        await this.layerManager.loadConfig();

        // Apply panel visibility state
        if (!this.layerManager.isPanelVisible()) {
            const sidebar = this.view?.leftSidebarHost;
            if (sidebar) {
                sidebar.addClass('is-collapsed');
            }
        }

        // Initialize Unified Store (register cleanup with lifecycle)
        this.store = createCartographerStore({
            isGuidedSetup: this.isGuidedSetupActive,
        });
        this.lifecycle.add(() => {
            this.store?.reset();
            this.store = null;
        });

        // Initialize abort controller for async operations (register with lifecycle)
        this.abortController = new AbortController();
        this.lifecycle.addAbortController(this.abortController);

        // Initialize tool panel (integrated editor functionality)
        await this.initializeToolPanel(view.sidebarHost);

        await this.mapManager.setFile(initialFile);
    }

    async onClose(): Promise<void> {
        // Execute all registered cleanup in LIFO order
        // This handles: abortController, store, toolManager, layerManager
        this.lifecycle.cleanup();

        // Cleanup undo manager (not registered with lifecycle as it's recreated on file change)
        this.editorUndoManager?.clear();
        this.editorUndoManager = null;

        // Cleanup view (not registered with lifecycle as it's optional)
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }

        // Cleanup render-time resources
        this.host = null;
        this.renderAbort?.abort();
        this.renderAbort = undefined;
        this.destroyMapLayer();
        this.currentOptions = null;
        this.mapManager = null;
        this.isMounted = false;
        this.abortController = null;
    }

    async setFile(file: TFile | null): Promise<void> {
        this.requestedFile = file;
        if (!this.mapManager) return;
        await this.mapManager.setFile(file);
    }

    private async initializeToolPanel(sidebarHost: HTMLElement): Promise<void> {
        // Create editor tool panel host
        this.toolBody = sidebarHost.createDiv({
            cls: "sm-cartographer__panel sm-cartographer__panel--editor"
        });

        // Create ToolPanelManager with extended context (legacy getters + store/bus)
        // Use arrow functions to capture 'this' correctly
        const self = this;
        const context: ExtendedToolContext = {
            // Legacy getters (deprecated - use store instead)
            app: this.app,
            getFile: () => this.currentFile,
            getHandles: () => this.mapLayer?.handles ?? null,
            getSurface: () => this.view?.surface ?? null,
            getOptions: () => this.currentOptions,
            getLayerPanel: () => this.view?.layerPanel ?? null,
            getBase: () => this.mapLayer?.handles?.base ?? { q: 0, r: 0 },
            getPadding: () => this.mapLayer?.handles?.padding ?? 12,
            getAbortSignal: () => this.abortController?.signal ?? null,
            setStatus: (_message: string, _tone?: "info" | "loading" | "error") => {
                // No-op: status bar removed
            },
            toContentPoint: (ev) => this.mapLayer?.handles?.toContentPoint(ev) ?? null,

            // Safe accessor - returns null when no map loaded
            getUndoManager: () => self.editorUndoManager ?? null,

            // Explicit requirement with clear error
            requireUndoManager: () => {
                if (!self.editorUndoManager) {
                    throw new Error("UndoManager required but not available - no map file loaded");
                }
                return self.editorUndoManager;
            },

            switchTool: async (toolId: string) => {
                await self.toolManager?.switchTo(toolId);
            },

            // Guided setup context
            isGuidedSetup: () => self.isGuidedSetupActive,
            clearGuidedSetup: () => { self.isGuidedSetupActive = false; },

            // Store for direct access
            store: this.store!,
        };

        this.toolManager = new ToolPanelManager(this.toolBody, context);

        // Register cleanup with lifecycle
        this.lifecycle.add(() => {
            this.toolManager?.destroy();
            this.toolManager = null;
            this.toolBody = null;
        });

        // Register tool change callback for terrain brush auto-show
        let savedTerrainLayerConfig: { visible: boolean; opacity: number } | null = null;
        this.toolManager.setToolChangeCallback((newTool, oldTool) => {
            const layerPanel = this.view?.layerPanel;
            if (!layerPanel) return;

            if (newTool === 'terrain-brush') {
                const currentConfig = layerPanel.getLayerConfigById('terrain');
                if (currentConfig) {
                    savedTerrainLayerConfig = { visible: currentConfig.visible, opacity: currentConfig.opacity };
                    layerPanel.setLayerConfigById('terrain', { visible: true, opacity: currentConfig.opacity });
                }
            } else if (oldTool === 'terrain-brush' && savedTerrainLayerConfig) {
                layerPanel.setLayerConfigById('terrain', savedTerrainLayerConfig);
                savedTerrainLayerConfig = null;
            }
        });

        // Switch to default tool (Base Layer for guided setup)
        await this.toolManager.switchTo("gradient-brush");

        logger.info("Tool panel initialized", {
            defaultTool: this.toolManager.getCurrentTool(),
        });
    }

    private async handleSave(_mode: MapHeaderSaveMode, _file: TFile | null): Promise<boolean> {
        // Save functionality can be implemented here if needed
        // Currently no save logic exists in editor mode
        return false;
    }

    private async handleHexClick(coord: AxialCoord, event: CustomEvent): Promise<void> {
        try {
            await this.toolManager?.handleHexClick(coord, event.detail.nativeEvent as PointerEvent);
        } catch (error) {
            logger.error("hex click failed", { coord, error });
        }
    }

    private async applyCurrentFile(
        file: TFile | null = this.currentFile,
    ): Promise<void> {
        this.currentFile = file ?? null;
        this.requestedFile = file ?? null;

        const view = this.view;
        if (!view) return;

        view.setFileLabel(this.currentFile);
        this.renderAbort?.abort();
        const controller = new AbortController();
        this.renderAbort = controller;
        const { signal } = controller;

        try {
            // Load map data (options + layer rendering)
            const result = await loadMap(this.app, this.currentFile, view, {
                loadHexOptions: this.deps.loadHexOptions,
                createMapLayer: this.deps.createMapLayer,
            }, signal);

            // Handle load failure (no file, no options, or rendering error)
            if (!result.layer || !result.options) {
                this.handleLoadFailure(view, result.overlayMessage);
                return;
            }

            // Apply successful load
            await this.handleLoadSuccess(view, file, result);

            logger.info("File changed", {
                file: file?.path,
                hasHandles: !!result.layer.handles,
                hasUndoManager: !!this.editorUndoManager,
                currentTool: this.toolManager?.getCurrentTool(),
            });
        } finally {
            if (signal.aborted) {
                this.destroyMapLayer();
                this.currentOptions = null;
                view.clearMap();
            }
            if (this.renderAbort === controller) {
                this.renderAbort = undefined;
            }
        }
    }

    /**
     * Handle failed map load (no file, no options, or rendering error)
     */
    private handleLoadFailure(view: CartographerViewHandle, overlayMessage: string | null): void {
        this.destroyMapLayer();
        view.clearMap();
        this.currentOptions = null;
        view.setOverlay(overlayMessage);

        // Update tool panel state (no map loaded)
        this.clearUndoManager();
        this.toolManager?.updateUndoManager(null);
        this.toolManager?.setDisabled(true);
    }

    /**
     * Handle successful map load (setup all systems)
     */
    private async handleLoadSuccess(
        view: CartographerViewHandle,
        file: TFile | null,
        result: { layer: MapLayer; options: HexOptions; overlayMessage: string | null }
    ): Promise<void> {
        // Apply layer and options
        this.destroyMapLayer();
        this.mapLayer = result.layer;
        this.currentOptions = result.options;
        view.setOverlay(null);

        // Update store with file state
        if (file && this.store) {
            this.store.patch(actions.fileLoaded(file, result.options));
        }

        // Setup hex click callback
        result.layer.handles.setHexClickCallback((coord, ev) => {
            void this.handleHexClick(coord, ev as CustomEvent<AxialCoord>);
            return "handled";
        });

        // Setup tooltips
        view.attachTooltipListeners(result.layer.handles, this.currentFile);

        // Setup elevation visualization
        await this.setupElevationVisualization(result.layer.handles);

        // Initialize map systems (climate, factions, terrain features)
        await this.initializeMapSystems(result.options);

        // Finalize tool state (undo manager + tool notification)
        this.finalizeToolState(file, result.layer.handles);
    }

    /**
     * Setup elevation visualization renderers and environment panel
     */
    private async setupElevationVisualization(handles: RenderHandles | null): Promise<void> {
        if (!handles || !this.view || !this.currentFile) return;

        await this.layerManager?.createElevationRenderers(this.currentFile, handles, {
            ...handles,
            sidebarHost: this.view.sidebarHost,
        });
    }

    /**
     * Initialize map systems (climate, factions, terrain features)
     */
    private async initializeMapSystems(options: HexOptions): Promise<void> {
        const initResult = await initializeMapSystems(this.app, this.currentFile, options);
        if (initResult.warnings.length > 0) {
            logger.warn("Map system initialization completed with warnings", {
                warnings: initResult.warnings,
            });
        }
    }

    /**
     * Setup undo manager for editing operations
     */
    private setupUndoManager(file: TFile | null): void {
        // Cleanup old undo manager
        this.clearUndoManager();

        // Create new undo manager only if file exists
        if (file) {
            const { tileCache } = getMapSession(this.app, file);
            this.editorUndoManager = new UndoManager(this.app, file, tileCache);
            this.toolManager?.updateUndoManager(this.editorUndoManager);
        } else {
            this.toolManager?.updateUndoManager(null);
        }
    }

    /**
     * Clear undo manager state
     */
    private clearUndoManager(): void {
        if (this.editorUndoManager) {
            this.editorUndoManager.clear();
            this.editorUndoManager = null;
        }
    }

    /**
     * Notify tools that map has been rendered
     */
    private notifyToolsOfMapRender(handles: RenderHandles | null): void {
        if (handles) {
            this.toolManager?.onMapRendered();
        }
        this.toolManager?.setDisabled(!handles);
    }

    /**
     * Finalize tool state after map load completes.
     * Sets up undo manager, updates store, and notifies tools of the new map.
     */
    private finalizeToolState(file: TFile | null, handles: RenderHandles | null): void {
        this.setupUndoManager(file);

        // Update store with handles and undoManager for direct tool access
        if (this.store) {
            this.store.patch({
                handles: handles ?? null,
                undoManager: this.editorUndoManager,
            });
        }

        this.notifyToolsOfMapRender(handles);
    }

    private destroyMapLayer(): void {
        const layer = this.mapLayer;
        this.mapLayer = null;

        // Clear elevation renderers and environment panel
        this.layerManager?.destroyElevationRenderers(this.currentFile);

        if (!layer) return;
        try {
            layer.destroy();
        } catch (error) {
            logger.error("failed to destroy map layer", error);
        }
    }

    // ==================== Layer Panel Integration ====================
    // (Delegated to LayerManager)

    toggleLayerPanel(): void {
        this.layerManager?.togglePanel(this.view?.leftSidebarHost ?? null);
    }

    toggleLayer(layerId: string): void {
        this.layerManager?.toggleLayer(layerId);
    }

    applyLayerPreset(presetId: string): void {
        this.layerManager?.applyPreset(presetId);
    }

    // ==================== Keyboard Shortcut Helpers ====================

    getCurrentMode(): string | null {
        return "editor"; // Only one mode now
    }

    getCurrentTool(): string | null {
        return this.toolManager?.getCurrentTool() ?? null;
    }

    async switchTool(toolId: string): Promise<void> {
        await this.toolManager?.switchTo(toolId);
        this.view?.toolbar?.setActive(toolId);

        // Update store
        this.store?.patch(actions.toolChanged(toolId));
    }

    toggleToolMode(): void {
        const panel = this.toolManager?.getActivePanel();
        if (panel && typeof panel.toggleMode === 'function') {
            panel.toggleMode();
        }
    }

    showHelp(): void {
        const modal = new CartographerKeyboardShortcutsHelpModal(this.app);
        modal.open();
    }

    /** Undo last operation */
    async undo(): Promise<void> {
        if (!this.editorUndoManager) return;
        try {
            await this.editorUndoManager.undo();
            const summary = this.editorUndoManager.getUndoSummary();
            new Notice(`Undone: ${summary || "operation"}`);
        } catch (error) {
            new Notice(`Cannot undo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /** Redo last undone operation */
    async redo(): Promise<void> {
        if (!this.editorUndoManager) return;
        try {
            await this.editorUndoManager.redo();
            const summary = this.editorUndoManager.getRedoSummary();
            new Notice(`Redone: ${summary || "operation"}`);
        } catch (error) {
            new Notice(`Cannot redo: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get the Unified Store instance (for external integrations).
     */
    getStore(): CartographerStore | null {
        return this.store;
    }
}
