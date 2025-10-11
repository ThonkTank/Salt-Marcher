// src/apps/session-runner/controller.ts
// Controller: Stellt den Travel-Workflow als eigenständige Session-Runner-Ansicht bereit.
import { Notice, type App, type TFile } from "obsidian";
import { parseOptions, type HexOptions } from "../../core/options";
import { getFirstHexBlock } from "../../core/map-list";
import type { RenderHandles } from "../../core/hex-mapper/hex-render";
import { createMapLayer, type MapLayer } from "./travel/ui/map-layer";
import { createMapManager, type MapManagerHandle } from "../../ui/map-manager";
import {
    createMapHeader,
    type MapHeaderHandle,
    type MapHeaderSaveMode,
} from "../../ui/map-header";
import { createViewContainer } from "../../ui/view-container";

export type HexCoord = { r: number; c: number };
export type SessionRunnerContext = {
    readonly app: App;
    readonly host: HTMLElement;
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
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
    readonly sidebarHost: HTMLElement;
    setFileLabel(file: TFile | null): void;
    setOverlay(content: string | null): void;
    clearMap(): void;
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

        const view = createSessionRunnerView({
            app: this.app,
            host,
            initialFile,
            callbacks: this.callbacks,
        });
        this.view = view;

        this.baseCtx = {
            app: this.app,
            host,
            mapHost: view.mapHost,
            sidebarHost: view.sidebarHost,
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

            const controller = new AbortController();
            const lifecycleCtx = this.createLifecycleContext(controller.signal);
            this.lifecycle = { controller, ctx: lifecycleCtx };

            await experience.onEnter(lifecycleCtx);
            await this.applyCurrentFile(initialFile, lifecycleCtx);
        } catch (error) {
            console.error("[session-runner] failed to start experience", error);
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

        if (lifecycle) lifecycle.controller.abort();
        if (experience && lifecycle) {
            try {
                await experience.onExit(lifecycle.ctx);
            } catch (error) {
                console.error("[session-runner] experience exit failed", error);
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
                console.error("[session-runner] failed to parse map options", error);
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
                console.error("[session-runner] failed to render map", error);
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
            console.error("[session-runner] onFileChange failed", error);
        }
    }

    private async handleSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> {
        if (!this.experience || !this.lifecycle) return false;
        try {
            if (!this.experience.onSave) return false;
            return (await this.experience.onSave(mode, file, this.lifecycle.ctx)) ?? false;
        } catch (error) {
            console.error("[session-runner] onSave failed", error);
            return false;
        }
    }

    private async handleHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): Promise<void> {
        if (!this.experience || !this.lifecycle?.ctx || !this.experience.onHexClick) return;
        try {
            await this.experience.onHexClick(coord, event, this.lifecycle.ctx);
        } catch (error) {
            console.error("[session-runner] onHexClick failed", error);
        }
    }

    private destroyMapLayer(): void {
        const layer = this.mapLayer;
        this.mapLayer = null;
        if (!layer) return;
        try {
            layer.destroy();
        } catch (error) {
            console.error("[session-runner] failed to destroy map layer", error);
        }
    }
}

type CreateSessionRunnerViewOptions = {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    callbacks: SessionRunnerControllerCallbacks;
};

function createSessionRunnerView(options: CreateSessionRunnerViewOptions): SessionRunnerViewHandle {
    const { app, host, initialFile, callbacks } = options;

    host.empty();
    host.addClass("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const bodyHost = host.createDiv({ cls: "sm-cartographer__body" });
    const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar" });
    const surface = createViewContainer(mapWrapper, { camera: false });

    const headerHandle: MapHeaderHandle = createMapHeader(app, headerHost, {
        title: "Session Runner",
        initialFile,
        onOpen: (file) => callbacks.onOpen(file),
        onCreate: (file) => callbacks.onCreate(file),
        onDelete: (file) => callbacks.onDelete(file),
        onSave: (mode, file) => callbacks.onSave(mode, file),
    });

    const hexListener = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const detail = event.detail as HexCoord | undefined;
        if (!detail) return;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        void Promise.resolve(callbacks.onHexClick(detail, event as CustomEvent<HexCoord>)).catch((error) => {
            console.error("[session-runner] hex click handler failed", error);
        });
    };
    surface.stageEl.addEventListener("hex:click", hexListener as EventListener, { passive: false });

    return {
        mapHost: surface.stageEl,
        sidebarHost,
        setFileLabel: (file) => headerHandle.setFileLabel(file),
        setOverlay: (content) => surface.setOverlay(content),
        clearMap: () => surface.stageEl.empty(),
        destroy: () => {
            surface.stageEl.removeEventListener("hex:click", hexListener as EventListener);
            headerHandle.destroy();
            surface.destroy();
            host.empty();
            host.removeClass("sm-cartographer");
        },
    } satisfies SessionRunnerViewHandle;
}
