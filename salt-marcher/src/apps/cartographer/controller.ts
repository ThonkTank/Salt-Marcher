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

    private activeMode: CartographerMode | null = null;
    private lifecycle: { controller: AbortController; ctx: CartographerModeLifecycleContext } | null = null;

    private renderAbort?: AbortController;
    private modeLoad?: Promise<Map<string, CartographerMode>>;
    private activeModeId?: string;
    private shellModes: ModeShellEntry[] = [];

    constructor(app: App, deps?: Partial<CartographerControllerDeps>) {
        this.app = app;
        const defaults = createDefaultDeps(app);
        this.deps = {
            ...defaults,
            ...deps,
            modeDescriptors: deps?.modeDescriptors ?? defaults.modeDescriptors,
        } as CartographerControllerDeps;

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

        const descriptors = this.deps.modeDescriptors;
        const shellModes: ModeShellEntry[] = descriptors.map((descriptor) => ({
            id: descriptor.id,
            label: descriptor.label,
        }));
        this.shellModes = [...shellModes];

        this.view = createControllerView({
            app: this.app,
            host,
            initialFile,
            modes: shellModes,
            callbacks: this.callbacks,
        });

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.applyCurrentFile(file);
            },
        });

        this.view.setModes(this.shellModes, this.shellModes[0]?.id ?? null);
        this.view.setFileLabel(initialFile);

        let initialModeId = shellModes[0]?.id ?? null;
        try {
            const modes = await this.loadModesOnce();
            const firstEntry = modes.keys().next();
            if (!firstEntry.done) {
                initialModeId = firstEntry.value;
            }
        } catch {
            // overlay and notice already handled in loadModesOnce
        }

        if (initialModeId) {
            await this.setMode(initialModeId);
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

        if (this.activeMode && lifecycle) {
            try {
                await this.activeMode.onExit(lifecycle.ctx);
            } catch (error) {
                console.error("[cartographer] mode exit failed", error);
            }
        }

        this.activeMode = null;
        this.lifecycle = null;
        this.activeModeId = undefined;

        this.renderAbort?.abort();
        this.destroyMapLayer();
        this.view?.clearMap();
        this.currentOptions = null;
        this.shellModes = [];

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

    private async loadModesOnce(): Promise<Map<string, CartographerMode>> {
        if (!this.modeLoad) {
            const descriptors = this.deps.modeDescriptors;
            this.modeLoad = Promise.all(
                descriptors.map(async (descriptor) => {
                    const mode = await descriptor.load();
                    return { descriptor, mode } as const;
                }),
            )
                .then((entries) => {
                    const map = new Map<string, CartographerMode>();
                    const shellModes: ModeShellEntry[] = [];
                    for (const { mode } of entries) {
                        map.set(mode.id, mode);
                        shellModes.push({ id: mode.id, label: mode.label });
                    }
                    if (map.size === 0) {
                        throw new Error("No cartographer modes available");
                    }
                    this.shellModes = [...shellModes];
                    this.view?.setModes(this.shellModes, this.activeModeId ?? this.shellModes[0]?.id ?? null);
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

    async setMode(id: string, ctx?: ModeSelectContext): Promise<void> {
        let modes: Map<string, CartographerMode>;
        try {
            modes = await this.loadModesOnce();
        } catch {
            return;
        }

        const requested = modes.get(id) ?? null;
        const fallbackEntry = modes.entries().next();
        const nextEntry = requested
            ? ([requested.id, requested] as const)
            : fallbackEntry.done
              ? null
              : fallbackEntry.value;
        if (!nextEntry) return;

        const [nextId, nextMode] = nextEntry;

        if (this.activeModeId === nextId) {
            this.view?.setModes(this.shellModes, nextMode.id);
            return;
        }

        if (!this.isMounted || !this.view) {
            this.activeModeId = nextId;
            return;
        }

        const previous = this.activeMode;
        const previousLifecycle = this.lifecycle;
        if (previousLifecycle) {
            previousLifecycle.controller.abort();
        }
        this.activeMode = null;
        this.lifecycle = null;
        this.activeModeId = undefined;

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
        this.activeMode = nextMode;
        this.activeModeId = nextId;

        this.view.setModes(this.shellModes, nextMode.id);

        try {
            await nextMode.onEnter(lifecycleCtx);
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error("[cartographer] mode enter failed", error);
            }
        }

        if (controller.signal.aborted) return;

        await this.applyCurrentFile(this.currentFile, lifecycleCtx);
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

    private async applyCurrentFile(
        file: TFile | null = this.currentFile,
        lifecycleCtx?: CartographerModeLifecycleContext | null,
    ): Promise<void> {
        this.currentFile = file ?? null;
        this.requestedFile = file ?? null;

        const view = this.view;
        if (!view) return;

        view.setFileLabel(this.currentFile);

        if (!this.activeMode || !this.lifecycle) {
            this.destroyMapLayer();
            view.clearMap();
            this.currentOptions = null;
            return;
        }

        if (this.renderAbort) {
            this.renderAbort.abort();
        }
        const controller = new AbortController();
        this.renderAbort = controller;
        const signal = controller.signal;

        const ctx = lifecycleCtx ?? this.lifecycle.ctx ?? null;

        let provisionalLayer: MapLayer | null = null;
        const destroyProvisionalLayer = () => {
            if (!provisionalLayer) return;
            try {
                provisionalLayer.destroy();
            } catch (error) {
                console.error("[cartographer] failed to destroy map layer", error);
            }
            provisionalLayer = null;
        };

        this.destroyMapLayer();
        view.clearMap();
        this.currentOptions = null;

        try {
            if (!this.currentFile) {
                view.setOverlay("Keine Karte ausgewählt.");
                if (ctx) {
                    await this.activeMode.onFileChange(null, null, ctx);
                }
                return;
            }

            let options: HexOptions | null = null;
            try {
                options = await this.deps.loadHexOptions(this.app, this.currentFile);
            } catch (error) {
                console.error("[cartographer] failed to parse map options", error);
            }

            if (signal.aborted) return;

            if (!options) {
                view.setOverlay("Kein hex3x3-Block in dieser Datei.");
                if (ctx) {
                    await this.activeMode.onFileChange(this.currentFile, null, ctx);
                }
                return;
            }

            try {
                provisionalLayer = await this.deps.createMapLayer(
                    this.app,
                    view.mapHost,
                    this.currentFile,
                    options,
                );
            } catch (error) {
                console.error("[cartographer] failed to render map", error);
                view.setOverlay("Karte konnte nicht geladen werden.");
                if (ctx) {
                    await this.activeMode.onFileChange(this.currentFile, null, ctx);
                }
                return;
            }

            if (signal.aborted || !this.view) return;

            this.mapLayer = provisionalLayer;
            provisionalLayer = null;
            this.currentOptions = options;
            view.setOverlay(null);
            if (ctx) {
                await this.activeMode.onFileChange(this.currentFile, this.mapLayer.handles, ctx);
            }
        } finally {
            if (signal.aborted) {
                this.destroyMapLayer();
                view.clearMap();
                this.currentOptions = null;
            }
            destroyProvisionalLayer();
            if (this.renderAbort === controller) {
                this.renderAbort = undefined;
            }
        }
    }

    private destroyMapLayer(): void {
        const layer = this.mapLayer;
        if (!layer) return;
        this.mapLayer = null;
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

function createControllerView(options: CreateControllerViewOptions): CartographerViewHandle {
    const { app, host, initialFile, modes, callbacks } = options;

    host.empty();
    host.addClass("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const bodyHost = host.createDiv({ cls: "sm-cartographer__body" });
    const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar" });

    const surface = createViewContainer(mapWrapper, { camera: false });
    let modeHandle: ModeSelectHandle | null = null;
    let currentModes = [...modes];
    let currentActiveId: string | null = modes[0]?.id ?? null;

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

    const createModeControls = (slot: HTMLElement) => {
        modeHandle?.destroy();

        modeHandle = renderModeSelect(slot, currentModes, currentActiveId, (id) => {
            currentActiveId = id;
            invokeModeSelect(id);
        });
        currentActiveId = modeHandle.getActiveId();
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
            createModeControls(slot);
        },
    });

    if (!modeHandle) {
        createModeControls(headerHandle.titleRightSlot);
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
        modeHandle?.destroy();
        modeHandle = null;
        currentActiveId = null;
        currentModes = [];
        headerHandle.destroy();
        surface.destroy();
        host.empty();
        host.removeClass("sm-cartographer");
    };

    modeHandle?.setModes(currentModes, currentActiveId);
    currentActiveId = modeHandle?.getActiveId() ?? currentActiveId;

    return {
        host,
        mapHost: surface.stageEl,
        sidebarHost,
        setFileLabel: (file) => {
            headerHandle.setFileLabel(file);
        },
        setModes: (nextModes, activeId) => {
            currentModes = [...nextModes];
            const requestedActive = activeId !== undefined ? activeId : currentActiveId;
            if (modeHandle) {
                modeHandle.setModes(currentModes, requestedActive);
                currentActiveId = modeHandle.getActiveId();
            } else {
                const fallbackActive =
                    requestedActive && currentModes.some((mode) => mode.id === requestedActive)
                        ? requestedActive
                        : currentModes[0]?.id ?? null;
                currentActiveId = fallbackActive ?? null;
            }
        },
        setOverlay: (content) => {
            surface.setOverlay(content);
        },
        clearMap: () => {
            surface.stageEl.empty();
        },
        destroy,
    } satisfies CartographerViewHandle;
}

type ModeSelectHandle = {
    setModes(modes: ModeShellEntry[], activeId?: string | null): void;
    getActiveId(): string | null;
    destroy(): void;
};

function renderModeSelect(
    slot: HTMLElement,
    modes: ModeShellEntry[],
    initialActiveId: string | null,
    onChange: (id: string) => void | Promise<unknown>,
): ModeSelectHandle {
    slot.empty();
    slot.addClass("sm-cartographer__mode-slot");

    const labelEl = slot.createEl("span", {
        cls: "sm-cartographer__mode-label",
        text: DEFAULT_MODE_LABEL,
    });
    const selectEl = slot.createEl("select", { cls: "sm-cartographer__mode-select" });
    selectEl.setAttribute("aria-label", "Cartographer mode");

    const updateLabel = () => {
        const label = selectEl.selectedOptions[0]?.textContent ?? DEFAULT_MODE_LABEL;
        labelEl.setText(label);
        selectEl.title = label;
    };

    let currentModes: ModeShellEntry[] | null = null;
    let activeId: string | null = null;

    const rebuildOptions = (list: ModeShellEntry[]) => {
        selectEl.empty();
        if (list.length === 0) {
            const option = selectEl.createEl("option", { text: "Keine Modi" });
            option.value = "";
            option.disabled = true;
            option.selected = true;
            selectEl.disabled = true;
            selectEl.value = "";
            activeId = null;
            updateLabel();
            return;
        }

        selectEl.disabled = false;
        for (const mode of list) {
            const option = selectEl.createEl("option", { text: mode.label });
            option.value = mode.id;
        }
    };

    const syncSelection = (list: ModeShellEntry[], nextActiveId: string | null) => {
        if (list.length === 0) {
            activeId = null;
            updateLabel();
            return;
        }
        const fallbackId = nextActiveId && list.some((mode) => mode.id === nextActiveId)
            ? nextActiveId
            : list[0]?.id ?? "";
        selectEl.value = fallbackId ?? "";
        activeId = selectEl.value || null;
        updateLabel();
    };

    const applyModes = (list: ModeShellEntry[], nextActiveId: string | null) => {
        const shouldRebuild =
            currentModes === null ||
            currentModes.length !== list.length ||
            currentModes.some((prev, index) => {
                const next = list[index];
                return !next || prev.id !== next.id || prev.label !== next.label;
            });
        currentModes = [...list];
        if (shouldRebuild) {
            rebuildOptions(list);
        }
        syncSelection(list, nextActiveId);
    };

    const handleChange = () => {
        const id = selectEl.value;
        activeId = id || null;
        updateLabel();
        if (!id) return;
        onChange(id);
    };

    selectEl.addEventListener("change", handleChange);

    applyModes(modes, initialActiveId);

    return {
        setModes: (nextModes, nextActiveId) => {
            const requested = nextActiveId !== undefined ? nextActiveId : selectEl.value || null;
            applyModes(nextModes, requested);
        },
        getActiveId: () => activeId,
        destroy: () => {
            selectEl.removeEventListener("change", handleChange);
            slot.empty();
            activeId = null;
            currentModes = null;
        },
    };
}

