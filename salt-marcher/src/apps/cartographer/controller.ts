// src/apps/cartographer/controller.ts
// Controller: Verwaltet Cartographer-Zustand mit minimaler Lifecycle-Logik und direkter View-Anbindung.

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

export type CartographerModeLifecycleContext = CartographerModeContext & {
    readonly signal: AbortSignal;
};

export interface CartographerMode {
    readonly id: string;
    readonly label: string;
    onEnter(ctx: CartographerModeLifecycleContext): void | Promise<void>;
    onExit(ctx: CartographerModeLifecycleContext): void | Promise<void>;
    onFileChange(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: CartographerModeLifecycleContext,
    ): void | Promise<void>;
    onHexClick?(
        coord: HexCoord,
        event: CustomEvent<HexCoord>,
        ctx: CartographerModeLifecycleContext,
    ): void | Promise<void>;
    onSave?(
        mode: MapHeaderSaveMode,
        file: TFile | null,
        ctx: CartographerModeLifecycleContext,
    ): void | Promise<void | boolean> | boolean;
}

export type CartographerModeDescriptor = {
    readonly id: string;
    readonly label: string;
    readonly load: () => Promise<CartographerMode>;
};

const DEFAULT_MODE_DESCRIPTORS: readonly CartographerModeDescriptor[] = [
    {
        id: "travel",
        label: "Travel",
        async load() {
            const { createTravelGuideMode } = await import("./modes/travel-guide");
            return createTravelGuideMode();
        },
    },
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
    onModeSelect(id: string, ctx?: ModeSelectContext): Promise<void> | void;
    onOpen(file: TFile): Promise<void> | void;
    onCreate(file: TFile): Promise<void> | void;
    onDelete(file: TFile): Promise<void> | void;
    onSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> | boolean;
    onHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): Promise<void> | void;
};

type ModeSelectContext = { readonly signal: AbortSignal };

type ModeShellEntry = { id: string; label: string };

type CartographerViewHandle = {
    readonly host: HTMLElement;
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
    setFileLabel(file: TFile | null): void;
    setModeActive(id: string | null): void;
    setModeLabel(label: string): void;
    setModes(modes: ModeShellEntry[]): void;
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
        if (!block) return null;
        return parseOptions(block);
    },
    modeDescriptors: DEFAULT_MODE_DESCRIPTORS,
});

const MODE_PROVISION_OVERLAY_MESSAGE = "Cartographer-Modi konnten nicht geladen werden.";
const MODE_PROVISION_NOTICE_MESSAGE =
    "Cartographer-Modi konnten nicht geladen werden. Bitte die Konsole prüfen.";

const DEFAULT_MODE_LABEL = "Mode";

export class CartographerController {
    private static readonly neverAbortSignal: AbortSignal = new AbortController().signal;

    private readonly app: App;
    private readonly deps: CartographerControllerDeps;

    readonly callbacks: CartographerControllerCallbacks;

    private host: HTMLElement | null = null;
    private view: CartographerViewHandle | null = null;
    private mapManager: MapManagerHandle | null = null;
    private currentFile: TFile | null = null;
    private currentOptions: HexOptions | null = null;
    private mapLayer: MapLayer | null = null;
    private requestedFile: TFile | null = null;
    private isMounted = false;

    private readonly modeDescriptors: readonly CartographerModeDescriptor[];
    private modes: CartographerMode[] = [];
    private modeLoadFailed = false;
    private modeNoticeIssued = false;

    private activeMode: CartographerMode | null = null;
    private lifecycle: { controller: AbortController; ctx: CartographerModeLifecycleContext } | null = null;

    private renderToken = 0;
    private modeChange: Promise<void> = Promise.resolve();

    constructor(app: App, deps?: Partial<CartographerControllerDeps>) {
        this.app = app;
        const defaults = createDefaultDeps(app);
        this.deps = {
            ...defaults,
            ...deps,
            modeDescriptors: deps?.modeDescriptors ?? defaults.modeDescriptors,
        } as CartographerControllerDeps;
        this.modeDescriptors = this.deps.modeDescriptors;

        this.callbacks = {
            onModeSelect: (id, ctx) => this.setMode(id, ctx),
            onOpen: async (file) => {
                await this.mapManager?.setFile(file);
            },
            onCreate: async (file) => {
                await this.mapManager?.setFile(file);
            },
            onDelete: async () => {
                this.mapManager?.deleteCurrent();
            },
            onSave: async (mode, file) => {
                return await this.handleSave(mode, file);
            },
            onHexClick: async (coord, event) => {
                await this.handleHexClick(coord, event);
            },
        } satisfies CartographerControllerCallbacks;
    }

    async onOpen(host: HTMLElement, fallbackFile: TFile | null): Promise<void> {
        await this.onClose();

        this.host = host;
        this.isMounted = true;

        const initialFile = this.requestedFile ?? fallbackFile ?? null;
        this.currentFile = initialFile;
        this.requestedFile = initialFile;

        const shellModes: ModeShellEntry[] = this.modeDescriptors.map((descriptor) => ({
            id: descriptor.id,
            label: descriptor.label,
        }));

        this.view = createControllerView({
            app: this.app,
            host,
            initialFile,
            modes: shellModes,
            callbacks: this.callbacks,
        });

        if (this.modeLoadFailed) {
            this.view.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
        }

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.handleFileChange(file);
            },
        });

        this.view.setModes(shellModes);
        this.view.setModeActive(shellModes[0]?.id ?? null);
        this.view.setModeLabel(shellModes[0]?.label ?? DEFAULT_MODE_LABEL);
        this.view.setFileLabel(initialFile);

        await this.ensureModesLoaded();
        const firstMode = this.modes[0] ?? null;
        if (firstMode) {
            await this.setMode(firstMode.id);
        } else if (this.modeLoadFailed) {
            this.view.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
        }

        await this.mapManager.setFile(initialFile);
    }

    async onClose(): Promise<void> {
        if (!this.isMounted) {
            this.view?.destroy();
            this.view = null;
            this.host = null;
            this.mapManager = null;
            return;
        }

        this.isMounted = false;

        const lifecycle = this.lifecycle;
        if (lifecycle) {
            lifecycle.controller.abort();
        }

        const pending = this.modeChange;
        this.modeChange = Promise.resolve();
        try {
            await pending;
        } catch (error) {
            console.error("[cartographer] pending mode change failed", error);
        }

        if (this.activeMode && lifecycle) {
            try {
                await this.activeMode.onExit(lifecycle.ctx);
            } catch (error) {
                console.error("[cartographer] mode exit failed", error);
            }
        }

        this.activeMode = null;
        this.lifecycle = null;

        await this.teardownLayer();

        this.view?.destroy();
        this.view = null;
        this.host = null;
        this.mapManager = null;
    }

    async setFile(file: TFile | null): Promise<void> {
        this.requestedFile = file;
        if (!this.mapManager) return;
        await this.mapManager.setFile(file);
    }

    private async ensureModesLoaded(): Promise<void> {
        if (this.modes.length > 0) {
            this.view?.setModes(this.modes.map((mode) => ({ id: mode.id, label: mode.label })));
            return;
        }

        const loaded: CartographerMode[] = [];
        for (const descriptor of this.modeDescriptors) {
            try {
                const mode = await descriptor.load();
                loaded.push(mode);
            } catch (error) {
                console.error(`[cartographer] failed to load mode '${descriptor.id}'`, error);
            }
        }

        this.modes = loaded;
        this.view?.setModes(loaded.map((mode) => ({ id: mode.id, label: mode.label })));

        if (loaded.length === 0) {
            this.modeLoadFailed = true;
            this.showModeProvisionFailure();
        } else {
            this.modeLoadFailed = false;
            this.view?.setOverlay(null);
        }
    }

    private showModeProvisionFailure(): void {
        if (!this.modeNoticeIssued) {
            new Notice(MODE_PROVISION_NOTICE_MESSAGE);
            this.modeNoticeIssued = true;
        }
        this.view?.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
    }

    private queueModeChange(task: () => Promise<void>): Promise<void> {
        const next = this.modeChange.then(task, task);
        this.modeChange = next.catch(() => {});
        return next;
    }

    async setMode(id: string, ctx?: ModeSelectContext): Promise<void> {
        const change = this.queueModeChange(async () => {
            await this.performModeChange(id, ctx);
        });
        try {
            await change;
        } catch (error) {
            console.error("[cartographer] mode transition failed", error);
        }
    }

    private async performModeChange(id: string, ctx?: ModeSelectContext): Promise<void> {
        if (!this.isMounted || !this.view) return;

        await this.ensureModesLoaded();
        if (this.modeLoadFailed) {
            this.showModeProvisionFailure();
            return;
        }

        const next = this.modes.find((mode) => mode.id === id) ?? this.modes[0] ?? null;
        if (!next) return;

        if (next === this.activeMode) {
            this.view.setModeActive(next.id);
            this.view.setModeLabel(next.label);
            return;
        }

        const previous = this.activeMode;
        const previousLifecycle = this.lifecycle;
        if (previousLifecycle) {
            previousLifecycle.controller.abort();
        }
        this.activeMode = null;
        this.lifecycle = null;

        if (previous && previousLifecycle) {
            try {
                await previous.onExit(previousLifecycle.ctx);
            } catch (error) {
                console.error("[cartographer] mode exit failed", error);
            }
        }

        const controller = new AbortController();
        const external = ctx?.signal;
        if (external) {
            if (external.aborted) controller.abort();
            else external.addEventListener("abort", () => controller.abort(), { once: true });
        }

        const lifecycleCtx = this.createLifecycleContext(controller.signal);
        this.lifecycle = { controller, ctx: lifecycleCtx };
        this.activeMode = next;

        this.view.setModeActive(next.id);
        this.view.setModeLabel(next.label);

        try {
            await next.onEnter(lifecycleCtx);
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error("[cartographer] mode enter failed", error);
            }
        }

        if (controller.signal.aborted) return;

        await this.refresh();
    }

    private async handleFileChange(file: TFile | null): Promise<void> {
        this.currentFile = file;
        this.requestedFile = file;
        this.view?.setFileLabel(file);
        await this.refresh();
    }

    private async handleSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> {
        if (!this.activeMode?.onSave || !this.lifecycle) return false;
        try {
            const handled = await this.activeMode.onSave(mode, file, this.lifecycle.ctx);
            return handled === true;
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
        if (!this.view || !this.host) {
            throw new Error("CartographerController is not mounted.");
        }
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

    private async refresh(): Promise<void> {
        const view = this.view;
        if (!view) return;
        if (this.modeLoadFailed) {
            view.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
            return;
        }

        const token = ++this.renderToken;
        await this.teardownLayer();
        if (token !== this.renderToken) return;

        const lifecycle = this.lifecycle;
        const ctx = lifecycle?.ctx ?? null;
        const signal = lifecycle?.controller.signal ?? CartographerController.neverAbortSignal;

        if (!this.currentFile) {
            view.clearMap();
            view.setOverlay("Keine Karte ausgewählt.");
            this.currentOptions = null;
            if (ctx) {
                await this.activeMode?.onFileChange(null, null, ctx);
            }
            return;
        }

        let options: HexOptions | null = null;
        try {
            options = await this.deps.loadHexOptions(this.app, this.currentFile);
        } catch (error) {
            console.error("[cartographer] failed to parse map options", error);
        }

        if (token !== this.renderToken) return;

        if (!options) {
            view.clearMap();
            view.setOverlay("Kein hex3x3-Block in dieser Datei.");
            this.currentOptions = null;
            if (ctx) {
                await this.activeMode?.onFileChange(this.currentFile, null, ctx);
            }
            return;
        }

        try {
            const layer = await this.deps.createMapLayer(this.app, view.mapHost, this.currentFile, options);
            if (token !== this.renderToken || !this.view) {
                layer.destroy();
                return;
            }
            if (signal.aborted) {
                layer.destroy();
                return;
            }
            this.mapLayer = layer;
            this.currentOptions = options;
            view.setOverlay(null);
            if (ctx) {
                await this.activeMode?.onFileChange(this.currentFile, layer.handles, ctx);
            }
        } catch (error) {
            console.error("[cartographer] failed to render map", error);
            view.clearMap();
            view.setOverlay("Karte konnte nicht geladen werden.");
            this.currentOptions = null;
            if (ctx) {
                await this.activeMode?.onFileChange(this.currentFile, null, ctx);
            }
        }
    }

    private async teardownLayer(): Promise<void> {
        if (this.mapLayer) {
            try {
                this.mapLayer.destroy();
            } catch (error) {
                console.error("[cartographer] failed to destroy map layer", error);
            }
            this.mapLayer = null;
        }
        this.view?.clearMap();
        this.currentOptions = null;
    }
}

type CreateControllerViewOptions = {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    modes: ModeShellEntry[];
    callbacks: CartographerControllerCallbacks;
};

type ModeState = {
    modes: ModeShellEntry[];
    active: string | null;
    label: string;
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

    const state: ModeState = {
        modes: [...modes],
        active: modes[0]?.id ?? null,
        label: modes[0]?.label ?? DEFAULT_MODE_LABEL,
    };

    let selectEl: HTMLSelectElement | null = null;
    let labelEl: HTMLElement | null = null;
    let modeChangeHandler: (() => void) | null = null;

    const updateLabel = (label: string) => {
        state.label = label;
        labelEl?.setText(label);
        if (selectEl) {
            selectEl.title = label;
        }
    };

    const ensureLabel = () => {
        if (state.active) {
            const active = state.modes.find((mode) => mode.id === state.active);
            if (active) {
                updateLabel(active.label);
                return;
            }
        }
        if (state.modes[0]) {
            updateLabel(state.modes[0].label);
        } else {
            updateLabel(DEFAULT_MODE_LABEL);
        }
    };

    const applyModes = () => {
        if (!selectEl) return;
        selectEl.empty();
        if (state.modes.length === 0) {
            const option = selectEl.createEl("option", { text: "Keine Modi" });
            option.value = "";
            option.disabled = true;
            option.selected = true;
            selectEl.disabled = true;
            return;
        }
        selectEl.disabled = false;
        for (const mode of state.modes) {
            const option = selectEl.createEl("option", { text: mode.label });
            option.value = mode.id;
        }
        if (state.active && state.modes.some((mode) => mode.id === state.active)) {
            selectEl.value = state.active;
        } else {
            selectEl.value = state.modes[0]?.id ?? "";
        }
    };

    const setModeActive = (id: string | null) => {
        state.active = id;
        if (!selectEl) return;
        if (id && state.modes.some((mode) => mode.id === id)) {
            selectEl.value = id;
        } else {
            selectEl.value = "";
        }
    };

    const setModes = (nextModes: ModeShellEntry[]) => {
        state.modes = [...nextModes];
        applyModes();
        ensureLabel();
        if (state.active && !state.modes.some((mode) => mode.id === state.active)) {
            state.active = null;
        }
    };

    const setModeLabel = (label: string) => {
        updateLabel(label);
    };

    const invokeModeSelect = (id: string) => {
        try {
            const result = callbacks.onModeSelect(id);
            if (result && typeof (result as Promise<unknown>).then === "function") {
                void (result as Promise<unknown>).catch((error) => {
                    console.error("[cartographer] failed to select mode", error);
                });
            }
        } catch (error) {
            console.error("[cartographer] failed to select mode", error);
        }
    };

    const initModeControls = (slot: HTMLElement) => {
        slot.empty();
        slot.addClass("sm-cartographer__mode-slot");
        labelEl = slot.createEl("span", { cls: "sm-cartographer__mode-label", text: state.label });
        selectEl = slot.createEl("select", { cls: "sm-cartographer__mode-select" });
        selectEl.setAttribute("aria-label", "Cartographer mode");
        modeChangeHandler = () => {
            if (!selectEl) return;
            const id = selectEl.value;
            if (!id) return;
            invokeModeSelect(id);
        };
        selectEl.addEventListener("change", modeChangeHandler);
        selectEl.addEventListener("input", modeChangeHandler);
        applyModes();
        ensureLabel();
        if (state.active && selectEl) {
            selectEl.value = state.active;
        }
    };

    const headerHandle: MapHeaderHandle = createMapHeader(app, headerHost, {
        title: "Cartographer",
        initialFile,
        onOpen: async (file) => {
            await callbacks.onOpen(file);
        },
        onCreate: async (file) => {
            await callbacks.onCreate(file);
        },
        onDelete: async (file) => {
            await callbacks.onDelete(file);
        },
        onSave: async (mode, file) => {
            return await callbacks.onSave(mode, file);
        },
        titleRightSlot: (slot) => {
            initModeControls(slot);
        },
    });

    if (!selectEl) {
        initModeControls(headerHandle.titleRightSlot);
    }

    const handleHexClick = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const custom = event as CustomEvent<HexCoord>;
        if (custom.cancelable) custom.preventDefault();
        event.stopPropagation();
        const detail = custom.detail;
        if (!detail) return;
        try {
            const result = callbacks.onHexClick(detail, custom);
            if (result && typeof (result as Promise<unknown>).then === "function") {
                void (result as Promise<unknown>).catch((error) => {
                    console.error("[cartographer] hex click handler failed", error);
                });
            }
        } catch (error) {
            console.error("[cartographer] hex click handler failed", error);
        }
    };

    surface.stageEl.addEventListener("hex:click", handleHexClick as EventListener, { passive: false });

    const destroy = () => {
        surface.stageEl.removeEventListener("hex:click", handleHexClick as EventListener);
        if (selectEl && modeChangeHandler) {
            selectEl.removeEventListener("change", modeChangeHandler);
            selectEl.removeEventListener("input", modeChangeHandler);
        }
        headerHandle.destroy();
        surface.destroy();
        host.empty();
        host.removeClass("sm-cartographer");
    };

    setModes(modes);
    setModeActive(state.active);
    setModeLabel(state.label);

    return {
        host,
        mapHost: surface.stageEl,
        sidebarHost,
        setFileLabel: (file) => {
            headerHandle.setFileLabel(file);
        },
        setModeActive,
        setModeLabel,
        setModes,
        setOverlay: (content) => {
            surface.setOverlay(content);
        },
        clearMap: () => {
            surface.stageEl.empty();
        },
        destroy,
    } satisfies CartographerViewHandle;
}

