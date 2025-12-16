// src/workmodes/session-runner/session-runner-controller.ts
// Controller: Stellt den Travel-Workflow als eigenständige Session-Runner-Ansicht bereit.
import { Notice, type App, type TFile, type WorkspaceLeaf } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { parseOptions, type HexOptions } from "@features/maps";

const logger = configurableLogger.forModule("session-controller");
import { createViewContainer } from "@ui/components/view-container";
import {
    createMapHeader,
    type MapHeaderHandle,
    type MapHeaderSaveMode,
} from "@ui/maps/components/map-header";
import { getFirstHexBlock } from "@ui/maps/components/map-list";
import { createMapManager, type MapManagerHandle } from "@ui/maps/workflows/map-manager";
import { createMapLayer, type MapLayer } from "./travel/ui/map-layer";
import type { AxialCoord as HexCoord } from "@geometry";
import type { RenderHandles } from "@features/maps";
import {
    createAbortController,
    disposeSharedLifecycle,
    type LifecycleHandle,
} from "./session-runner-lifecycle-manager";
import { openEncounterTracker } from "./view/controllers/encounter/encounter-tracker-view";

export type { HexCoord };
export type SessionRunnerContext = {
    readonly app: App;
    readonly host: HTMLElement;
    readonly mapHost: HTMLElement;
    readonly leftSidebarHost: HTMLElement;
    readonly rightSidebarHost: HTMLElement;
    getFile(): TFile | null;
    getMapLayer(): MapLayer | null;
    getRenderHandles(): RenderHandles | null;
    getOptions(): HexOptions | null;
};
export type SessionRunnerLifecycleContext = SessionRunnerContext & { readonly signal: AbortSignal };

type MaybePromise<T> = T | Promise<T>;

export type SessionRunnerExperience = {
    readonly id: string;
    readonly label: string;
    onEnter(ctx: SessionRunnerLifecycleContext): MaybePromise<void>;
    onExit(ctx: SessionRunnerLifecycleContext): MaybePromise<void>;
    onFileChange(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: SessionRunnerLifecycleContext,
    ): MaybePromise<void>;
    onHexClick?(coord: HexCoord, event: CustomEvent<HexCoord>, ctx: SessionRunnerLifecycleContext): MaybePromise<void>;
    onSave?(mode: MapHeaderSaveMode, file: TFile | null, ctx: SessionRunnerLifecycleContext): MaybePromise<boolean>;
};

export type SessionRunnerControllerCallbacks = {
    onOpen(file: TFile): MaybePromise<void>;
    onCreate(file: TFile): MaybePromise<void>;
    onDelete(file: TFile): MaybePromise<void>;
    onSave(mode: MapHeaderSaveMode, file: TFile | null): MaybePromise<boolean>;
    onHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): MaybePromise<void>;
};

type SessionRunnerViewHandle = {
    readonly mapHost: HTMLElement;
    readonly leftSidebarHost: HTMLElement;
    readonly rightSidebarHost: HTMLElement;
    setFileLabel(file: TFile | null): void;
    setOverlay(content: string | null): void;
    clearMap(): void;
    toggleLeftSidebar(): void;
    toggleRightSidebar(): void;
    destroy(): void;
};

type SessionRunnerControllerDeps = {
    createMapManager(app: App, options: Parameters<typeof createMapManager>[1]): MapManagerHandle;
    createMapLayer(app: App, host: HTMLElement, file: TFile, opts: HexOptions): Promise<MapLayer>;
    loadHexOptions(app: App, file: TFile): Promise<HexOptions | null>;
    loadExperience(): Promise<SessionRunnerExperience>;
};

const createDefaultDeps = (app: App): SessionRunnerControllerDeps => ({
    createMapManager: (appInstance, options) => createMapManager(appInstance, options),
    createMapLayer: (appInstance, host, file, opts) => createMapLayer(appInstance, host, file, opts),
    loadHexOptions: async (appInstance, file) => {
        const block = await getFirstHexBlock(appInstance, file);
        return block ? parseOptions(block) : null;
    },
    loadExperience: async () => {
        const { createSessionRunnerExperience } = await import("./view/experience");
        return createSessionRunnerExperience();
    },
});

const EXPERIENCE_OVERLAY_MESSAGE = "Session Runner konnte nicht initialisiert werden.";
const EXPERIENCE_NOTICE_MESSAGE = "Session Runner konnte nicht geladen werden. Bitte die Konsole pruefen.";

export class SessionRunnerController {
    private readonly app: App;
    private readonly deps: SessionRunnerControllerDeps;
    readonly callbacks: SessionRunnerControllerCallbacks;

    private view: SessionRunnerViewHandle | null = null;
    private host: HTMLElement | null = null;
    private mapManager: MapManagerHandle | null = null;
    private currentFile: TFile | null = null;
    private requestedFile: TFile | null = null;
    private currentOptions: HexOptions | null = null;
    private mapLayer: MapLayer | null = null;
    private isMounted = false;
    private encounterLeaf: WorkspaceLeaf | null = null;

    private baseCtx: Omit<SessionRunnerContext, "signal"> | null = null;
    private lifecycle: { controller: AbortController; ctx: SessionRunnerLifecycleContext } | null = null;
    private renderAbort?: AbortController;
    private experienceLoad?: Promise<SessionRunnerExperience>;
    private experience: SessionRunnerExperience | null = null;

    constructor(app: App, deps: Partial<SessionRunnerControllerDeps> = {}) {
        this.app = app;
        const defaults = createDefaultDeps(app);
        this.deps = {
            ...defaults,
            ...deps,
            loadExperience: deps.loadExperience ?? defaults.loadExperience,
        } satisfies SessionRunnerControllerDeps;

        this.callbacks = {
            onOpen: (file) => this.mapManager?.setFile(file),
            onCreate: (file) => this.mapManager?.setFile(file),
            onDelete: () => this.mapManager?.deleteCurrent(),
            onSave: (mode, file) => this.handleSave(mode, file),
            onHexClick: (coord, event) => this.handleHexClick(coord, event),
        } satisfies SessionRunnerControllerCallbacks;
    }

    async onOpen(host: HTMLElement, fallbackFile: TFile | null): Promise<void> {
        await this.onClose();

        this.host = host;
        this.isMounted = true;
        const initialFile = this.requestedFile ?? fallbackFile ?? null;
        this.currentFile = initialFile;
        this.requestedFile = initialFile;

        // Get plugin instance from app
        const plugin = (this.app as any).plugins?.plugins?.["salt-marcher"];
        if (!plugin) {
            logger.error("Could not find plugin instance");
        }

        const view = createSessionRunnerView({
            app: this.app,
            host,
            initialFile,
            callbacks: this.callbacks,
            plugin: plugin || ({} as any), // Fallback to empty object if plugin not found
        });
        this.view = view;

        this.baseCtx = {
            app: this.app,
            host,
            mapHost: view.mapHost,
            leftSidebarHost: view.leftSidebarHost,
            rightSidebarHost: view.rightSidebarHost,
            getFile: () => this.currentFile,
            getMapLayer: () => this.mapLayer,
            getRenderHandles: () => this.mapLayer?.handles ?? null,
            getOptions: () => this.currentOptions,
        } satisfies SessionRunnerContext;

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.applyCurrentFile(file);
            },
        });

        view.setFileLabel(initialFile);

        try {
            const experience = await this.ensureExperience();
            if (!this.isMounted || !this.view) {
                return;
            }

            const controller = createAbortController("session-runner-experience");
            const lifecycleCtx = this.createLifecycleContext(controller.signal);
            this.lifecycle = { controller, ctx: lifecycleCtx };

            await experience.onEnter(lifecycleCtx);
            await this.applyCurrentFile(initialFile, lifecycleCtx);

            // Auto-open Encounter Tracker in right sidebar
            try {
                const encounterTrackerHandle = await openEncounterTracker(this.app);
                logger.info("Encounter Tracker opened in right sidebar");

                // Pass the handle to experience so it can update nearby creatures on hex change
                if (experience && 'setEncounterTrackerHandle' in experience) {
                    (experience as any).setEncounterTrackerHandle(encounterTrackerHandle);
                }
            } catch (error) {
                logger.warn("Failed to auto-open Encounter Tracker", error);
            }
        } catch (error) {
            logger.error("failed to start experience", error);
            this.view?.setOverlay(EXPERIENCE_OVERLAY_MESSAGE);
            new Notice(EXPERIENCE_NOTICE_MESSAGE);
        }

        if (this.mapManager) {
            await this.mapManager.setFile(initialFile);
        }
    }

    async onClose(): Promise<void> {
        const lifecycle = this.lifecycle;
        const experience = this.experience;
        this.lifecycle = null;
        this.experience = experience;

        // Close Encounter Tracker (unified lifecycle)
        if (this.encounterLeaf) {
            try {
                await this.encounterLeaf.detach();
                logger.info("Encounter Tracker closed (unified lifecycle)");
            } catch (error) {
                logger.warn("Failed to close Encounter Tracker", error);
            }
            this.encounterLeaf = null;
        }

        if (lifecycle) lifecycle.controller.abort();
        if (experience && lifecycle) {
            try {
                await experience.onExit(lifecycle.ctx);
            } catch (error) {
                logger.error("experience exit failed", error);
            }
        }

        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
        this.host = null;
        this.renderAbort?.abort();
        this.renderAbort = undefined;
        this.destroyMapLayer();
        this.currentOptions = null;
        this.mapManager = null;
        this.baseCtx = null;
        this.isMounted = false;
    }

    async setFile(file: TFile | null): Promise<void> {
        this.requestedFile = file;
        if (!this.mapManager) return;
        await this.mapManager.setFile(file);
    }

    private async ensureExperience(): Promise<SessionRunnerExperience> {
        if (!this.experienceLoad) {
            this.experienceLoad = this.deps
                .loadExperience()
                .then((experience) => {
                    this.experience = experience;
                    this.view?.setOverlay(null);
                    return experience;
                })
                .catch((error) => {
                    this.experienceLoad = undefined;
                    throw error;
                });
        }
        const experience = await this.experienceLoad;
        this.experience = experience;
        return experience;
    }

    private createLifecycleContext(signal: AbortSignal): SessionRunnerLifecycleContext {
        if (!this.baseCtx) {
            throw new Error("Session Runner context not initialised");
        }
        return { ...this.baseCtx, signal } satisfies SessionRunnerLifecycleContext;
    }

    private async applyCurrentFile(
        file: TFile | null = this.currentFile,
        lifecycleCtx: SessionRunnerLifecycleContext | null = this.lifecycle?.ctx ?? null,
    ): Promise<void> {
        this.currentFile = file ?? null;
        this.requestedFile = file ?? null;

        const view = this.view;
        const ctx = lifecycleCtx;
        if (!view || !ctx || !this.experience) return;

        view.setFileLabel(this.currentFile);
        this.renderAbort?.abort();
        const controller = new AbortController();
        this.renderAbort = controller;
        const { signal } = controller;

        try {
            if (!this.currentFile) {
                this.destroyMapLayer();
                view.clearMap();
                this.currentOptions = null;
                view.setOverlay("Keine Karte ausgewaehlt.");
                await this.safeFileChange(null, null, ctx);
                return;
            }

            let options: HexOptions | null = null;
            try {
                options = await this.deps.loadHexOptions(this.app, this.currentFile);
            } catch (error) {
                logger.error("failed to parse map options", error);
            }
            if (signal.aborted || !this.view) return;

            if (!options) {
                this.destroyMapLayer();
                view.clearMap();
                this.currentOptions = null;
                view.setOverlay("Kein hex3x3-Block in dieser Datei.");
                await this.safeFileChange(this.currentFile, null, ctx);
                return;
            }

            let layer: MapLayer | null = null;
            try {
                layer = await this.deps.createMapLayer(this.app, view.mapHost, this.currentFile, options);
            } catch (error) {
                logger.error("failed to render map", error);
                layer = null;
            }

            if (signal.aborted || !this.view) {
                layer?.destroy();
                return;
            }

            if (!layer) {
                this.destroyMapLayer();
                view.clearMap();
                this.currentOptions = null;
                view.setOverlay("Karte konnte nicht geladen werden.");
                await this.safeFileChange(this.currentFile, null, ctx);
                return;
            }

            this.destroyMapLayer();
            this.mapLayer = layer;
            this.currentOptions = options;
            view.setOverlay(null);

            // Configure climate engine with map settings
            this.applyClimateSettings(options);

            await this.safeFileChange(this.currentFile, layer.handles, ctx);
        } finally {
            if (signal.aborted) {
                this.destroyMapLayer();
                this.currentOptions = null;
                view?.clearMap();
            }
            if (this.renderAbort === controller) {
                this.renderAbort = undefined;
            }
        }
    }

    private async safeFileChange(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: SessionRunnerLifecycleContext,
    ): Promise<void> {
        try {
            await this.experience?.onFileChange(file, handles, ctx);
        } catch (error) {
            logger.error("onFileChange failed", error);
        }
    }

    private async handleSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> {
        if (!this.experience || !this.lifecycle) return false;
        try {
            if (!this.experience.onSave) return false;
            return (await this.experience.onSave(mode, file, this.lifecycle.ctx)) ?? false;
        } catch (error) {
            logger.error("onSave failed", error);
            return false;
        }
    }

    private async handleHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): Promise<void> {
        if (!this.experience || !this.lifecycle?.ctx || !this.experience.onHexClick) return;
        try {
            await this.experience.onHexClick(coord, event, this.lifecycle.ctx);
        } catch (error) {
            logger.error("onHexClick failed", error);
        }
    }

    /**
     * Apply climate settings from map options to the global climate engine.
     * This ensures all climate calculations use the correct base temperature and wind direction.
     */
    private applyClimateSettings(options: HexOptions): void {
        const { getClimateEngine } = require("@services/climate");
        const engine = getClimateEngine();

        engine.updateConfig({
            globalBaseTemperature: options.climate.globalBaseTemperature,
            globalWindDirection: options.climate.globalWindDirection,
        });

        logger.info("Applied climate settings from map", {
            baseTemperature: options.climate.globalBaseTemperature,
            windDirection: options.climate.globalWindDirection,
        });
    }

    private destroyMapLayer(): void {
        const layer = this.mapLayer;
        this.mapLayer = null;
        if (!layer) return;
        try {
            layer.destroy();
        } catch (error) {
            logger.error("failed to destroy map layer", error);
        }
    }
}

type CreateSessionRunnerViewOptions = {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    callbacks: SessionRunnerControllerCallbacks;
    plugin: import("../../app/main").default;
};

function createSessionRunnerView(options: CreateSessionRunnerViewOptions): SessionRunnerViewHandle {
    const { app, host, initialFile, callbacks, plugin } = options;

    host.empty();

    // Header
    const headerHost = host.createDiv({ cls: "sm-session__header" });

    // Body - 3 columns
    const bodyHost = host.createDiv({ cls: "sm-session__body" });
    const leftSidebarHost = bodyHost.createDiv({ cls: "sm-session__left-sidebar" });
    const canvasWrapper = bodyHost.createDiv({ cls: "sm-session__canvas" });
    const rightSidebarHost = bodyHost.createDiv({ cls: "sm-session__right-sidebar" });

    const surface = createViewContainer(canvasWrapper, { camera: false });

    // Header with map controls + sidebar toggles
    const headerHandle: MapHeaderHandle = createMapHeader(app, headerHost, {
        title: "Session Runner",
        initialFile,
        onOpen: (file) => callbacks.onOpen(file),
        onCreate: (file) => callbacks.onCreate(file),
        onDelete: (file) => callbacks.onDelete(file),
        onSave: (mode, file) => callbacks.onSave(mode, file),
    });

    // Sidebar toggle buttons
    const toggleLeftBtn = headerHost.createEl("button", {
        cls: "sm-session__sidebar-toggle is-active",
        text: "◧ Info"
    });
    const toggleRightBtn = headerHost.createEl("button", {
        cls: "sm-session__sidebar-toggle is-active",
        text: "Actions ◨"
    });

    // Hex click listener
    const hexListener = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const detail = event.detail as HexCoord | undefined;
        if (!detail) return;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        void Promise.resolve(callbacks.onHexClick(detail, event as CustomEvent<HexCoord>)).catch((error) => {
            logger.error("hex click handler failed", error);
        });
    };

    // Track all lifecycle handles for cleanup
    const lifecycleHandles: LifecycleHandle[] = [];

    // Register hex click event listener
    surface.stageEl.addEventListener("hex:click", hexListener as EventListener, { passive: false });
    lifecycleHandles.push(() => {
        surface.stageEl.removeEventListener("hex:click", hexListener as EventListener);
    });

    // Load initial sidebar states from settings
    const leftCollapsed = plugin.settings.sessionRunner?.leftSidebarCollapsed ?? false;
    const rightCollapsed = plugin.settings.sessionRunner?.rightSidebarCollapsed ?? false;

    if (leftCollapsed) {
        leftSidebarHost.addClass("is-collapsed");
        toggleLeftBtn.removeClass("is-active");
    }

    if (rightCollapsed) {
        rightSidebarHost.addClass("is-collapsed");
        toggleRightBtn.removeClass("is-active");
    }

    // Toggle functions with settings persistence
    const toggleLeftSidebar = () => {
        const isCollapsed = leftSidebarHost.hasClass("is-collapsed");
        if (isCollapsed) {
            leftSidebarHost.removeClass("is-collapsed");
            toggleLeftBtn.addClass("is-active");
        } else {
            leftSidebarHost.addClass("is-collapsed");
            toggleLeftBtn.removeClass("is-active");
        }

        // Save to settings
        if (!plugin.settings.sessionRunner) {
            plugin.settings.sessionRunner = {};
        }
        plugin.settings.sessionRunner.leftSidebarCollapsed = !isCollapsed;
        plugin.saveSettings().catch((err) => {
            logger.error("Failed to save left sidebar state", err);
        });
    };

    const toggleRightSidebar = () => {
        const isCollapsed = rightSidebarHost.hasClass("is-collapsed");
        if (isCollapsed) {
            rightSidebarHost.removeClass("is-collapsed");
            toggleRightBtn.addClass("is-active");
        } else {
            rightSidebarHost.addClass("is-collapsed");
            toggleRightBtn.removeClass("is-active");
        }

        // Save to settings
        if (!plugin.settings.sessionRunner) {
            plugin.settings.sessionRunner = {};
        }
        plugin.settings.sessionRunner.rightSidebarCollapsed = !isCollapsed;
        plugin.saveSettings().catch((err) => {
            logger.error("Failed to save right sidebar state", err);
        });
    };

    // Wire up toggle buttons with lifecycle tracking
    toggleLeftBtn.addEventListener("click", toggleLeftSidebar);
    lifecycleHandles.push(() => {
        toggleLeftBtn.removeEventListener("click", toggleLeftSidebar);
    });

    toggleRightBtn.addEventListener("click", toggleRightSidebar);
    lifecycleHandles.push(() => {
        toggleRightBtn.removeEventListener("click", toggleRightSidebar);
    });

    return {
        mapHost: surface.stageEl,
        leftSidebarHost,
        rightSidebarHost,
        setFileLabel: (file) => headerHandle.setFileLabel(file),
        setOverlay: (content) => surface.setOverlay(content),
        clearMap: () => surface.stageEl.empty(),
        toggleLeftSidebar,
        toggleRightSidebar,
        destroy: () => {
            // Cleanup all event listeners via lifecycle manager
            disposeSharedLifecycle("session-runner-view", lifecycleHandles);

            // Cleanup UI components
            headerHandle.destroy();
            surface.destroy();
            host.empty();
            host.removeClass("sm-session");
            host.removeClass("sm-session--travel");
        },
    } satisfies SessionRunnerViewHandle;
}
