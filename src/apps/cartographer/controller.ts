// src/apps/cartographer/controller.ts
// Controller: Reduziert den Cartographer-Lifecycle auf eine klar strukturierte, minimalistische Implementierung.

import { Notice, type App, type TFile } from "obsidian";
import { parseOptions, type HexOptions } from "../../core/options";
import { getFirstHexBlock } from "../../core/map-list";
import type { RenderHandles } from "../../core/hex-mapper/hex-render";
import { createMapLayer, type MapLayer } from "../session-runner/travel/ui/map-layer";
import { createMapManager, type MapManagerHandle } from "../../ui/map-manager";
import {
    createMapHeader,
    type MapHeaderHandle,
    type MapHeaderSaveMode,
} from "../../ui/map-header";
import { createViewContainer } from "../../ui/view-container";

export type HexCoord = { r: number; c: number };
export type CartographerModeContext = {
    readonly app: App;
    readonly host: HTMLElement;
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
    getFile(): TFile | null;
    getMapLayer(): MapLayer | null;
    getRenderHandles(): RenderHandles | null;
    getOptions(): HexOptions | null;
};
export type CartographerModeLifecycleContext = CartographerModeContext & { readonly signal: AbortSignal };

type MaybePromise<T> = T | Promise<T>;

export type CartographerMode = {
    readonly id: string;
    readonly label: string;
    onEnter(ctx: CartographerModeLifecycleContext): MaybePromise<void>;
    onExit(ctx: CartographerModeLifecycleContext): MaybePromise<void>;
    onFileChange(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: CartographerModeLifecycleContext,
    ): MaybePromise<void>;
    onHexClick?(
        coord: HexCoord,
        event: CustomEvent<HexCoord>,
        ctx: CartographerModeLifecycleContext,
    ): MaybePromise<void>;
    onSave?(
        mode: MapHeaderSaveMode,
        file: TFile | null,
        ctx: CartographerModeLifecycleContext,
    ): MaybePromise<boolean>;
};

export type CartographerModeDescriptor = {
    readonly id: string;
    readonly label: string;
    readonly load: () => Promise<CartographerMode>;
};

const DEFAULT_MODE_DESCRIPTORS: readonly CartographerModeDescriptor[] = [
    {
        id: "editor",
        label: "Editor",
        async load() {
            const { createEditorMode } = await import("./modes/editor");
            return createEditorMode();
        },
    },
    {
        id: "inspector",
        label: "Inspector",
        async load() {
            const { createInspectorMode } = await import("./modes/inspector");
            return createInspectorMode();
        },
    },
];

export type CartographerControllerCallbacks = {
    onModeSelect(id: string, ctx?: { readonly signal: AbortSignal }): MaybePromise<void>;
    onOpen(file: TFile): MaybePromise<void>;
    onCreate(file: TFile): MaybePromise<void>;
    onDelete(file: TFile): MaybePromise<void>;
    onSave(mode: MapHeaderSaveMode, file: TFile | null): MaybePromise<boolean>;
    onHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): MaybePromise<void>;
};

type ModeShellEntry = { readonly id: string; readonly label: string };
type CartographerViewHandle = {
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
    setFileLabel(file: TFile | null): void;
    setModes(modes: ModeShellEntry[], activeId?: string | null): void;
    setOverlay(content: string | null): void;
    clearMap(): void;
    destroy(): void;
};

type CartographerControllerDeps = {
    createMapManager(app: App, options: Parameters<typeof createMapManager>[1]): MapManagerHandle;
    createMapLayer(app: App, host: HTMLElement, file: TFile, opts: HexOptions): Promise<MapLayer>;
    loadHexOptions(app: App, file: TFile): Promise<HexOptions | null>;
    modeDescriptors: readonly CartographerModeDescriptor[];
};

const createDefaultDeps = (app: App): CartographerControllerDeps => ({
    createMapManager: (appInstance, options) => createMapManager(appInstance, options),
    createMapLayer: (appInstance, host, file, opts) => createMapLayer(appInstance, host, file, opts),
    loadHexOptions: async (appInstance, file) => {
        const block = await getFirstHexBlock(appInstance, file);
        return block ? parseOptions(block) : null;
    },
    modeDescriptors: DEFAULT_MODE_DESCRIPTORS,
});

const MODE_PROVISION_OVERLAY_MESSAGE = "Cartographer-Modi konnten nicht geladen werden.";
const MODE_PROVISION_NOTICE_MESSAGE =
    "Cartographer-Modi konnten nicht geladen werden. Bitte die Konsole prüfen.";

export class CartographerController {
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

    private modeLoad?: Promise<Map<string, CartographerMode>>;
    private shellModes: ModeShellEntry[] = [];
    private activeMode: CartographerMode | null = null;
    private activeModeId: string | null = null;
    private lifecycle: { controller: AbortController; ctx: CartographerModeLifecycleContext } | null = null;
    renderAbort?: AbortController;

    constructor(app: App, deps: Partial<CartographerControllerDeps> = {}) {
        this.app = app;
        const defaults = createDefaultDeps(app);
        this.deps = {
            ...defaults,
            ...deps,
            modeDescriptors: deps.modeDescriptors ?? defaults.modeDescriptors,
        };

        this.callbacks = {
            onModeSelect: (id, ctx) => this.setMode(id, ctx),
            onOpen: (file) => this.mapManager?.setFile(file),
            onCreate: (file) => this.mapManager?.setFile(file),
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

        const view = createControllerView({
            app: this.app,
            host,
            initialFile,
            modes: this.shellModes,
            callbacks: this.callbacks,
        });
        this.view = view;

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.applyCurrentFile(file);
            },
        });

        view.setModes(this.shellModes, this.activeModeId);
        view.setFileLabel(initialFile);

        let initialMode = this.activeModeId;
        try {
            const modes = await this.loadModesOnce();
            if (!initialMode) {
                const first = modes.keys().next();
                initialMode = first.done ? null : first.value;
            }
        } catch {
            // overlay already set
        }

        if (initialMode) {
            await this.setMode(initialMode);
        }

        await this.mapManager.setFile(initialFile);
    }

    async onClose(): Promise<void> {
        const lifecycle = this.lifecycle;
        const active = this.activeMode;
        this.lifecycle = null;
        this.activeModeId = null;
        this.activeMode = null;
        this.shellModes = [];

        if (lifecycle) lifecycle.controller.abort();
        if (active && lifecycle) {
            try {
                await active.onExit(lifecycle.ctx);
            } catch (error) {
                console.error("[cartographer] mode exit failed", error);
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
        this.isMounted = false;
    }

    async setFile(file: TFile | null): Promise<void> {
        this.requestedFile = file;
        if (!this.mapManager) return;
        await this.mapManager.setFile(file);
    }

    private async loadModesOnce(): Promise<Map<string, CartographerMode>> {
        if (!this.modeLoad) {
            this.modeLoad = Promise.all(
                this.deps.modeDescriptors.map(async (descriptor) => ({
                    descriptor,
                    mode: await descriptor.load(),
                })),
            )
                .then((entries) => {
                    const map = new Map<string, CartographerMode>();
                    this.shellModes = entries.map(({ mode }) => {
                        map.set(mode.id, mode);
                        return { id: mode.id, label: mode.label } satisfies ModeShellEntry;
                    });
                    this.view?.setModes(this.shellModes, this.activeModeId);
                    this.view?.setOverlay(null);
                    return map;
                })
                .catch((error) => {
                    console.error("[cartographer] failed to load modes", error);
                    this.view?.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
                    new Notice(MODE_PROVISION_NOTICE_MESSAGE);
                    this.modeLoad = undefined;
                    throw error;
                });
        }
        return this.modeLoad;
    }

    async setMode(id: string, ctx?: { readonly signal: AbortSignal }): Promise<void> {
        let modes: Map<string, CartographerMode>;
        try {
            modes = await this.loadModesOnce();
        } catch {
            return;
        }

        const next = modes.get(id) ?? modes.values().next().value ?? null;
        if (!next) return;
        if (this.activeModeId === next.id) {
            this.view?.setModes(this.shellModes, next.id);
            return;
        }

        const previousLifecycle = this.lifecycle;
        if (previousLifecycle) previousLifecycle.controller.abort();
        const previous = this.activeMode;
        this.activeMode = null;
        this.lifecycle = null;
        this.activeModeId = null;
        if (previous && previousLifecycle) {
            try {
                await previous.onExit(previousLifecycle.ctx);
            } catch (error) {
                console.error("[cartographer] mode exit failed", error);
            }
        }

        if (!this.isMounted || !this.view) {
            this.activeMode = next;
            this.activeModeId = next.id;
            return;
        }

        const controller = new AbortController();
        if (ctx?.signal) {
            if (ctx.signal.aborted) controller.abort();
            else ctx.signal.addEventListener("abort", () => controller.abort(), { once: true });
        }
        const lifecycleCtx = this.createLifecycleContext(controller.signal);
        this.lifecycle = { controller, ctx: lifecycleCtx };
        this.activeMode = next;
        this.activeModeId = next.id;
        this.view.setModes(this.shellModes, next.id);

        try {
            await next.onEnter(lifecycleCtx);
        } catch (error) {
            if (!controller.signal.aborted) console.error("[cartographer] mode enter failed", error);
        }

        if (controller.signal.aborted) return;
        await this.applyCurrentFile(this.currentFile, lifecycleCtx);
    }

    private async handleSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> {
        if (!this.activeMode?.onSave || !this.lifecycle) return false;
        try {
            return (await this.activeMode.onSave(mode, file, this.lifecycle.ctx)) === true;
        } catch (error) {
            console.error("[cartographer] mode onSave failed", error);
            return false;
        }
    }

    private async handleHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): Promise<void> {
        if (!this.activeMode?.onHexClick || !this.lifecycle) return;
        try {
            await this.activeMode.onHexClick(coord, event, this.lifecycle.ctx);
        } catch (error) {
            console.error("[cartographer] mode onHexClick failed", error);
        }
    }

    private get baseModeCtx(): CartographerModeContext {
        if (!this.view || !this.host) throw new Error("CartographerController is not mounted.");
        return {
            app: this.app,
            host: this.host,
            mapHost: this.view.mapHost,
            sidebarHost: this.view.sidebarHost,
            getFile: () => this.currentFile,
            getMapLayer: () => this.mapLayer,
            getRenderHandles: () => this.mapLayer?.handles ?? null,
            getOptions: () => this.currentOptions,
        } satisfies CartographerModeContext;
    }

    private createLifecycleContext(signal: AbortSignal): CartographerModeLifecycleContext {
        return { ...this.baseModeCtx, signal } satisfies CartographerModeLifecycleContext;
    }

    private async applyCurrentFile(
        file: TFile | null = this.currentFile,
        lifecycleCtx: CartographerModeLifecycleContext | null = this.lifecycle?.ctx ?? null,
    ): Promise<void> {
        this.currentFile = file ?? null;
        this.requestedFile = file ?? null;

        const view = this.view;
        const ctx = lifecycleCtx;
        if (!view || !ctx || !this.activeMode) return;

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
                view.setOverlay("Keine Karte ausgewählt.");
                await this.safeFileChange(null, null, ctx);
                return;
            }

            let options: HexOptions | null = null;
            try {
                options = await this.deps.loadHexOptions(this.app, this.currentFile);
            } catch (error) {
                console.error("[cartographer] failed to parse map options", error);
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
                console.error("[cartographer] failed to render map", error);
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
                view.clearMap();
            }
            if (this.renderAbort === controller) {
                this.renderAbort = undefined;
            }
        }
    }

    private async safeFileChange(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: CartographerModeLifecycleContext,
    ): Promise<void> {
        try {
            await this.activeMode?.onFileChange(file, handles, ctx);
        } catch (error) {
            console.error("[cartographer] mode onFileChange failed", error);
        }
    }

    private destroyMapLayer(): void {
        const layer = this.mapLayer;
        this.mapLayer = null;
        if (!layer) return;
        try {
            layer.destroy();
        } catch (error) {
            console.error("[cartographer] failed to destroy map layer", error);
        }
    }
}

type CreateControllerViewOptions = {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    modes: ModeShellEntry[];
    callbacks: CartographerControllerCallbacks;
};

type ModeSelectHandle = {
    setModes(modes: ModeShellEntry[], activeId?: string | null): void;
    destroy(): void;
};

function createControllerView(options: CreateControllerViewOptions): CartographerViewHandle {
    const { app, host, initialFile, modes, callbacks } = options;

    host.empty();
    host.addClass("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const bodyHost = host.createDiv({ cls: "sm-cartographer__body" });
    const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar" });
    const surface = createViewContainer(mapWrapper, { camera: false });

    let selectHandle: ModeSelectHandle | null = null;
    const headerHandle: MapHeaderHandle = createMapHeader(app, headerHost, {
        title: "Cartographer",
        initialFile,
        onOpen: (file) => callbacks.onOpen(file),
        onCreate: (file) => callbacks.onCreate(file),
        onDelete: (file) => callbacks.onDelete(file),
        onSave: (mode, file) => callbacks.onSave(mode, file),
        titleRightSlot: (slot) => {
            selectHandle = renderModeSelect(slot, modes, (id) => callbacks.onModeSelect(id));
        },
    });

    if (!selectHandle) {
        selectHandle = renderModeSelect(headerHandle.titleRightSlot, modes, (id) => callbacks.onModeSelect(id));
    }

    const hexListener = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const detail = event.detail as HexCoord | undefined;
        if (!detail) return;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        void Promise.resolve(callbacks.onHexClick(detail, event as CustomEvent<HexCoord>)).catch((error) => {
            console.error("[cartographer] hex click handler failed", error);
        });
    };
    surface.stageEl.addEventListener("hex:click", hexListener as EventListener, { passive: false });

    return {
        mapHost: surface.stageEl,
        sidebarHost,
        setFileLabel: (file) => headerHandle.setFileLabel(file),
        setModes: (nextModes, activeId) => selectHandle?.setModes(nextModes, activeId),
        setOverlay: (content) => surface.setOverlay(content),
        clearMap: () => surface.stageEl.empty(),
        destroy: () => {
            surface.stageEl.removeEventListener("hex:click", hexListener as EventListener);
            selectHandle?.destroy();
            headerHandle.destroy();
            surface.destroy();
            host.empty();
            host.removeClass("sm-cartographer");
        },
    } satisfies CartographerViewHandle;
}

function renderModeSelect(
    slot: HTMLElement,
    initialModes: ModeShellEntry[],
    onChange: (id: string) => MaybePromise<void>,
): ModeSelectHandle {
    slot.empty();
    slot.addClass("sm-cartographer__mode-slot");
    const selectEl = slot.createEl("select", { cls: "sm-cartographer__mode-select" });
    selectEl.setAttribute("aria-label", "Cartographer mode");

    let modes = [...initialModes];
    const sync = (list: ModeShellEntry[], activeId?: string | null) => {
        modes = [...list];
        selectEl.empty();
        if (modes.length === 0) {
            const option = selectEl.createEl("option", { text: "Keine Modi" });
            option.disabled = true;
            option.selected = true;
            selectEl.disabled = true;
            return;
        }
        for (const mode of modes) {
            const option = selectEl.createEl("option", { text: mode.label });
            option.value = mode.id;
        }
        selectEl.disabled = false;
        const requested = activeId && modes.some((mode) => mode.id === activeId) ? activeId : modes[0]?.id ?? "";
        selectEl.value = requested ?? "";
    };

    sync(modes);

    const handleChange = () => {
        const id = selectEl.value;
        if (!id) return;
        void Promise.resolve(onChange(id)).catch((error) => {
            console.error("[cartographer] failed to select mode", error);
        });
    };
    selectEl.addEventListener("change", handleChange);

    return {
        setModes: (nextModes, activeId) => sync(nextModes, activeId),
        destroy: () => {
            selectEl.removeEventListener("change", handleChange);
            slot.empty();
            modes = [];
        },
    } satisfies ModeSelectHandle;
}
