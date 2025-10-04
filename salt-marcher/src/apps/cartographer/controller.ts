// src/apps/cartographer/controller.ts
// Controller: Verwaltet Cartographer-Zustand und rendert Layout ohne separate View-Shell.

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
import { createViewContainer, type ViewContainerHandle } from "../../ui/view-container";

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

type ModeProvisionIssueState = {
    noticeIssued: boolean;
    overlayActive: boolean;
};

type ModeTransitionPhase = "idle" | "exiting" | "entering";

type ModeTransition = {
    readonly id: number;
    readonly next: CartographerMode;
    readonly previous: CartographerMode | null;
    readonly controller: AbortController;
    readonly externalSignal: AbortSignal | null;
    phase: ModeTransitionPhase;
};
export class CartographerController {
    private static readonly neverAbortSignal: AbortSignal = new AbortController().signal;

    private readonly app: App;
    private readonly deps: CartographerControllerDeps;

    readonly callbacks: CartographerControllerCallbacks;

    private view: CartographerViewHandle | null = null;
    private mapManager: MapManagerHandle | null = null;
    private currentFile: TFile | null = null;
    private currentOptions: HexOptions | null = null;
    private mapLayer: MapLayer | null = null;
    private activeMode: CartographerMode | null = null;
    private readonly modeDescriptors: readonly CartographerModeDescriptor[];
    private modes: CartographerMode[] = [];
    private hostEl: HTMLElement | null = null;
    private modeChange: Promise<void> = Promise.resolve();
    private readonly transitionTasks = new Set<Promise<void>>();
    private loadToken = 0;
    private isMounted = false;
    private requestedFile: TFile | null | undefined = undefined;
    private modeTransitionSeq = 0;
    private transition: ModeTransition | null = null;
    private activeLifecycleController: AbortController | null = null;
    private activeLifecycleContext: CartographerModeLifecycleContext | null = null;
    private modeProvisionIssue: ModeProvisionIssueState | null = null;

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

        this.hostEl = host;
        const initialFile = this.requestedFile ?? fallbackFile ?? null;
        this.currentFile = initialFile;

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

        this.applyModeProvisionOverlay();

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.handleFileChange(file);
            },
        });

        this.view.setModeLabel(shellModes[0]?.label ?? "Mode");
        this.view.setModeActive(shellModes[0]?.id ?? null);
        this.view.setFileLabel(initialFile);

        this.isMounted = true;
        this.requestedFile = initialFile;

        await this.ensureModesLoaded();
        const firstMode = this.modes[0] ?? null;
        if (firstMode) {
            await this.setMode(firstMode.id);
        }
        await this.mapManager.setFile(initialFile);
    }

    async onClose(): Promise<void> {
        if (!this.isMounted) {
            this.view?.destroy();
            this.view = null;
            this.hostEl = null;
            return;
        }

        this.isMounted = false;
        this.transition?.controller.abort();
        await this.modeChange;
        try {
            const controller = this.activeLifecycleController ?? new AbortController();
            if (!controller.signal.aborted) {
                controller.abort();
            }
            const ctx =
                this.activeLifecycleContext && this.activeLifecycleContext.signal === controller.signal
                    ? this.activeLifecycleContext
                    : this.createLifecycleContext(controller.signal);
            await this.activeMode?.onExit(ctx);
        } catch (err) {
            console.error("[cartographer] mode exit failed", err);
        }
        this.activeMode = null;
        this.activeLifecycleController = null;
        this.activeLifecycleContext = null;
        await this.teardownLayer();
        this.view?.destroy();
        this.view = null;
        this.hostEl = null;
        this.mapManager = null;
    }

    async setFile(file: TFile | null): Promise<void> {
        this.requestedFile = file;
        if (!this.isMounted || !this.mapManager) return;
        await this.mapManager.setFile(file);
    }

    private get baseModeCtx(): CartographerModeContext {
        if (!this.view || !this.hostEl) {
            throw new Error("CartographerController is not mounted.");
        }
        return {
            app: this.app,
            host: this.hostEl,
            mapHost: this.view.mapHost,
            sidebarHost: this.view.sidebarHost,
            getFile: () => this.currentFile,
            getMapLayer: () => this.mapLayer,
            getRenderHandles: () => this.mapLayer?.handles ?? null,
            getOptions: () => this.currentOptions,
        } satisfies CartographerModeContext;
    }

    private createLifecycleContext(signal: AbortSignal): CartographerModeLifecycleContext {
        const base = this.baseModeCtx;
        return { ...base, signal } satisfies CartographerModeLifecycleContext;
    }

    private ensureActiveLifecycleContext(signal: AbortSignal): CartographerModeLifecycleContext {
        const current = this.activeLifecycleContext;
        if (current && current.signal === signal) {
            return current;
        }

        const context = this.createLifecycleContext(signal);
        if (this.activeLifecycleController?.signal === signal) {
            this.activeLifecycleContext = context;
        }

        return context;
    }

    private getActiveLifecycleSignal(): AbortSignal {
        return this.activeLifecycleController?.signal ?? CartographerController.neverAbortSignal;
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

        if (loaded.length === 0) {
            this.modes = [];
            this.handleModeProvisionFailure(new Error("no modes available"));
            this.view?.setModes([]);
            return;
        }

        this.modes = loaded;
        this.clearModeProvisionIssue();
        this.view?.setModes(loaded.map((mode) => ({ id: mode.id, label: mode.label })));
    }

    private async handleFileChange(file: TFile | null): Promise<void> {
        this.currentFile = file;
        this.view?.setFileLabel(file);
        await this.refresh();
    }

    private async handleSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> {
        if (!this.activeMode?.onSave) return false;
        try {
            const ctx = this.ensureActiveLifecycleContext(this.getActiveLifecycleSignal());
            const handled = await this.activeMode.onSave(mode, file, ctx);
            return handled === true;
        } catch (err) {
            console.error("[cartographer] mode onSave failed", err);
            return false;
        }
    }

    private async handleHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): Promise<void> {
        if (!this.activeMode?.onHexClick) return;
        try {
            const ctx = this.ensureActiveLifecycleContext(this.getActiveLifecycleSignal());
            await this.activeMode.onHexClick(coord, event, ctx);
        } catch (err) {
            console.error("[cartographer] mode onHexClick failed", err);
        }
    }

    private handleModeProvisionFailure(error: unknown): void {
        console.error("[cartographer] failed to provide modes", error);

        const issue: ModeProvisionIssueState = this.modeProvisionIssue ?? {
            noticeIssued: false,
            overlayActive: false,
        };

        if (!issue.noticeIssued) {
            new Notice(MODE_PROVISION_NOTICE_MESSAGE);
            issue.noticeIssued = true;
        }

        issue.overlayActive = false;

        if (this.view) {
            this.view.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
            issue.overlayActive = true;
        } else {
            issue.overlayActive = false;
        }

        this.modeProvisionIssue = issue;
    }

    private applyModeProvisionOverlay(): void {
        if (!this.modeProvisionIssue || !this.view) {
            return;
        }

        this.view.setOverlay(MODE_PROVISION_OVERLAY_MESSAGE);
        this.modeProvisionIssue.overlayActive = true;
    }

    private clearModeProvisionIssue(): void {
        const issue = this.modeProvisionIssue;
        if (!issue) return;

        if (issue.overlayActive) {
            this.view?.setOverlay(null);
        }

        this.modeProvisionIssue = null;
    }

    async setMode(id: string, ctx?: ModeSelectContext): Promise<void> {
        const next = this.modes.find((mode) => mode.id === id) ?? this.modes[0];
        if (!next) return;

        const promise = this.executeModeTransition(next, ctx?.signal ?? null);
        this.trackTransition(promise);

        try {
            await promise;
        } catch (err) {
            console.error("[cartographer] mode transition crashed", err);
        }
    }

    private recalcModeChangePromise(): void {
        if (this.transitionTasks.size === 0) {
            this.modeChange = Promise.resolve();
            return;
        }

        this.modeChange = Promise.allSettled(Array.from(this.transitionTasks)).then(() => undefined);
    }

    private trackTransition(promise: Promise<void>): void {
        this.transitionTasks.add(promise);
        this.recalcModeChangePromise();

        promise
            .finally(() => {
                this.transitionTasks.delete(promise);
                this.recalcModeChangePromise();
            })
            .catch(() => {
                // intentionally ignored
            });
    }

    private bindExternalAbort(transition: ModeTransition): () => void {
        const { externalSignal, controller } = transition;
        if (!externalSignal) return () => {};

        const abort = () => {
            controller.abort();
        };

        if (externalSignal.aborted) {
            abort();
            return () => {};
        }

        externalSignal.addEventListener("abort", abort, { once: true });
        return () => {
            externalSignal.removeEventListener("abort", abort);
        };
    }

    private isTransitionAborted(transition: ModeTransition): boolean {
        if (transition.controller.signal.aborted) return true;
        if (transition.externalSignal?.aborted) return true;
        if (this.transition && this.transition.id !== transition.id) return true;
        return false;
    }

    private async runTransitionStep(
        transition: ModeTransition,
        phase: ModeTransitionPhase,
        action: () => Promise<void> | void,
        errorMessage: string,
    ): Promise<"completed" | "aborted"> {
        if (this.isTransitionAborted(transition)) {
            return "aborted";
        }

        transition.phase = phase;

        try {
            await action();
        } catch (err) {
            if (!this.isTransitionAborted(transition)) {
                console.error(errorMessage, err);
            }
        }

        if (this.isTransitionAborted(transition)) {
            return "aborted";
        }

        return "completed";
    }

    private async executeModeTransition(next: CartographerMode, externalSignal: AbortSignal | null): Promise<void> {
        const previousTransition = this.transition;
        if (previousTransition) {
            previousTransition.controller.abort();
        }

        if (this.activeMode?.id === next.id) {
            if (!(externalSignal?.aborted ?? false)) {
                this.view?.setModeActive(next.id);
                this.view?.setModeLabel(next.label);
            }
            return;
        }

        const previousLifecycleContext = this.activeLifecycleContext;
        const previousLifecycleController = this.activeLifecycleController;

        const controller = new AbortController();

        const transition: ModeTransition = {
            id: ++this.modeTransitionSeq,
            next,
            previous: this.activeMode,
            controller,
            externalSignal,
            phase: "idle",
        };

        this.transition = transition;
        const detachAbort = this.bindExternalAbort(transition);

        try {
            if (this.isTransitionAborted(transition)) {
                return;
            }

            const previous = transition.previous;
            if (previous) {
                const exitOutcome = await this.runTransitionStep(
                    transition,
                    "exiting",
                    () => {
                        if (previousLifecycleController && !previousLifecycleController.signal.aborted) {
                            try {
                                previousLifecycleController.abort();
                            } catch (err) {
                                console.error("[cartographer] failed to abort lifecycle controller", err);
                            }
                        }

                        const exitSignal =
                            previousLifecycleContext?.signal ??
                            previousLifecycleController?.signal ??
                            CartographerController.neverAbortSignal;
                        const exitCtx =
                            previousLifecycleContext && previousLifecycleContext.signal === exitSignal
                                ? previousLifecycleContext
                                : this.createLifecycleContext(exitSignal);

                        return previous.onExit(exitCtx);
                    },
                    "[cartographer] mode exit failed",
                );

                if (exitOutcome === "aborted") {
                    return;
                }

                this.activeMode = null;
                this.activeLifecycleContext = null;
            }

            if (this.isTransitionAborted(transition)) {
                return;
            }

            this.activeLifecycleController = controller;
            const modeCtx = this.ensureActiveLifecycleContext(transition.controller.signal);

            this.activeMode = transition.next;

            if (this.isTransitionAborted(transition)) {
                this.activeMode = null;
                this.activeLifecycleController = null;
                this.activeLifecycleContext = null;
                return;
            }

            const enterOutcome = await this.runTransitionStep(
                transition,
                "entering",
                () => transition.next.onEnter(modeCtx),
                "[cartographer] mode enter failed",
            );

            if (enterOutcome === "aborted") {
                this.activeMode = null;
                this.activeLifecycleController = null;
                this.activeLifecycleContext = null;
                return;
            }

            if (this.isTransitionAborted(transition)) {
                this.activeMode = null;
                this.activeLifecycleController = null;
                this.activeLifecycleContext = null;
                return;
            }

            const fileChangeOutcome = await this.runTransitionStep(
                transition,
                "entering",
                () =>
                    transition.next.onFileChange(
                        this.currentFile,
                        this.mapLayer?.handles ?? null,
                        modeCtx,
                    ),
                "[cartographer] mode file change failed",
            );

            if (fileChangeOutcome === "aborted" && this.activeMode?.id === transition.next.id) {
                this.activeMode = null;
                this.activeLifecycleController = null;
                this.activeLifecycleContext = null;
                return;
            }

            this.view?.setModeActive(transition.next.id);
            this.view?.setModeLabel(transition.next.label);

            transition.phase = "idle";
        } catch (err) {
            if (!this.isTransitionAborted(transition)) {
                console.error("[cartographer] mode transition failed", err);
            }
        } finally {
            detachAbort();
            if (this.transition?.id === transition.id) {
                this.transition = null;
            }
            if (!this.activeMode) {
                this.activeLifecycleController = null;
                this.activeLifecycleContext = null;
            }
        }
    }

    private async refresh(): Promise<void> {
        const token = ++this.loadToken;
        await this.renderMap(token);
    }

    private async renderMap(token: number): Promise<void> {
        await this.teardownLayer();

        if (!this.view) return;
        if (this.modeProvisionIssue) {
            this.applyModeProvisionOverlay();
            return;
        }
        const transition = this.transition;
        const signal = transition?.controller.signal ?? this.getActiveLifecycleSignal();
        const ctx = this.ensureActiveLifecycleContext(signal);
        const isTransitionAborted = () => (transition ? this.isTransitionAborted(transition) : false);

        if (!this.currentFile) {
            this.view.clearMap();
            this.view.setOverlay("Keine Karte ausgewählt.");
            this.currentOptions = null;
            if (!isTransitionAborted()) {
                await this.activeMode?.onFileChange(null, null, ctx);
            }
            return;
        }

        let options: HexOptions | null = null;
        try {
            options = await this.deps.loadHexOptions(this.app, this.currentFile);
        } catch (err) {
            console.error("[cartographer] failed to parse map options", err);
        }

        if (!options) {
            this.view.clearMap();
            this.view.setOverlay("Kein hex3x3-Block in dieser Datei.");
            this.currentOptions = null;
            if (!isTransitionAborted()) {
                await this.activeMode?.onFileChange(this.currentFile, null, ctx);
            }
            return;
        }

        try {
            const layer = await this.deps.createMapLayer(this.app, this.view.mapHost, this.currentFile, options);
            if (token !== this.loadToken || !this.view) {
                layer.destroy();
                return;
            }
            if (isTransitionAborted()) {
                layer.destroy();
                return;
            }
            this.mapLayer = layer;
            this.currentOptions = options;
            this.view.setOverlay(null);
            if (!isTransitionAborted()) {
                await this.activeMode?.onFileChange(this.currentFile, this.mapLayer.handles, ctx);
            }
        } catch (err) {
            console.error("[cartographer] failed to render map", err);
            this.view.clearMap();
            this.view.setOverlay("Karte konnte nicht geladen werden.");
            this.currentOptions = null;
            if (!isTransitionAborted()) {
                await this.activeMode?.onFileChange(this.currentFile, null, ctx);
            }
        }
    }

    private async teardownLayer(): Promise<void> {
        if (this.mapLayer) {
            try {
                this.mapLayer.destroy();
            } catch (err) {
                console.error("[cartographer] failed to destroy map layer", err);
            }
            this.mapLayer = null;
        }
        this.view?.clearMap();
        this.currentOptions = null;
    }
}
const DEFAULT_MODE_LABEL = "Mode";

type CartographerLayout = {
    readonly host: HTMLElement;
    readonly headerHost: HTMLElement;
    readonly bodyHost: HTMLElement;
    readonly mapWrapper: HTMLElement;
    readonly sidebarHost: HTMLElement;
    destroy(): void;
};

function createCartographerLayout(host: HTMLElement): CartographerLayout {
    host.empty();
    host.addClass("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const bodyHost = host.createDiv({ cls: "sm-cartographer__body" });
    const mapWrapper = bodyHost.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = bodyHost.createDiv({ cls: "sm-cartographer__sidebar" });

    return {
        host,
        headerHost,
        bodyHost,
        mapWrapper,
        sidebarHost,
        destroy: () => {
            host.empty();
            host.removeClass("sm-cartographer");
        },
    };
}

type MapSurfaceHandle = {
    readonly view: ViewContainerHandle;
    readonly mapHost: HTMLElement;
    setOverlay(content: string | null): void;
    clear(): void;
    destroy(): void;
};

function createMapSurface(container: HTMLElement): MapSurfaceHandle {
    const view = createViewContainer(container, { camera: false });
    const mapHost = view.stageEl;

    return {
        view,
        mapHost,
        setOverlay: (content) => {
            view.setOverlay(content);
        },
        clear: () => {
            mapHost.empty();
        },
        destroy: () => {
            view.destroy();
            container.empty();
        },
    };
}

type ModeSwitchContext = ModeSelectContext;

type ModeSwitchHandler = (modeId: string, ctx: ModeSwitchContext) => Promise<void> | void;

type ModeControllerHandle = {
    requestMode(modeId: string): Promise<void>;
    abortActive(): void;
    destroy(): void;
};

function createModeController(options: { onSwitch: ModeSwitchHandler }): ModeControllerHandle {
    const { onSwitch } = options;
    let currentController: AbortController | null = null;
    let destroyed = false;
    let sequence = 0;

    const abortActive = () => {
        if (currentController) {
            currentController.abort();
            currentController = null;
        }
    };

    const requestMode = async (modeId: string): Promise<void> => {
        if (destroyed) return;

        sequence += 1;
        const token = sequence;

        if (currentController) {
            currentController.abort();
        }
        const controller = new AbortController();
        currentController = controller;

        try {
            await onSwitch(modeId, { signal: controller.signal });
        } catch (error) {
            if (!controller.signal.aborted) {
                throw error;
            }
        } finally {
            if (currentController === controller && token === sequence) {
                currentController = null;
            }
        }
    };

    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        abortActive();
    };

    return {
        requestMode,
        abortActive,
        destroy,
    };
}

type ModeMenuHandle = {
    setModes(modes: ModeShellEntry[]): void;
    setActiveMode(id: string | null): void;
    setTriggerLabel(label: string): void;
    destroy(): void;
};

type ModeMenuOptions = {
    host: HTMLElement;
    initialLabel: string;
    onSelect(modeId: string): void;
};

type ModeEntry = {
    mode: ModeShellEntry;
    button: HTMLButtonElement;
};

function createModeMenu(options: ModeMenuOptions): ModeMenuHandle {
    const { host, initialLabel, onSelect } = options;
    host.addClass("sm-cartographer__mode-switch");

    const dropdown = host.createDiv({ cls: "sm-mode-dropdown" });
    const trigger = dropdown.createEl("button", {
        text: initialLabel,
        attr: { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false" },
    });
    trigger.addClass("sm-mode-dropdown__trigger");

    const menu = dropdown.createDiv({ cls: "sm-mode-dropdown__menu", attr: { role: "listbox" } });

    const entries = new Map<string, ModeEntry>();
    let activeId: string | null = null;
    let unbindOutsideClick: (() => void) | null = null;
    let destroyed = false;

    const closeMenu = () => {
        dropdown.removeClass("is-open");
        trigger.setAttr("aria-expanded", "false");
        if (unbindOutsideClick) {
            unbindOutsideClick();
            unbindOutsideClick = null;
        }
    };

    const openMenu = () => {
        dropdown.addClass("is-open");
        trigger.setAttr("aria-expanded", "true");
        const onDocClick = (event: MouseEvent) => {
            if (!dropdown.contains(event.target as Node)) closeMenu();
        };
        document.addEventListener("mousedown", onDocClick);
        unbindOutsideClick = () => document.removeEventListener("mousedown", onDocClick);
    };

    trigger.onclick = () => {
        const isOpen = dropdown.classList.contains("is-open");
        if (isOpen) closeMenu();
        else openMenu();
    };

    const updateActive = () => {
        for (const entry of entries.values()) {
            const isActive = entry.mode.id === activeId;
            entry.button.classList.toggle("is-active", isActive);
            entry.button.ariaSelected = isActive ? "true" : "false";
        }
    };

    const ensureEntry = (mode: ModeShellEntry): ModeEntry => {
        const button = menu.createEl("button", {
            text: mode.label,
            attr: { role: "option", type: "button", "data-id": mode.id },
        });
        button.addClass("sm-mode-dropdown__item");
        button.onclick = () => {
            closeMenu();
            onSelect(mode.id);
        };
        const entry: ModeEntry = { mode, button };
        entries.set(mode.id, entry);
        return entry;
    };

    const removeEntry = (id: string) => {
        const entry = entries.get(id);
        if (!entry) return;
        entry.button.remove();
        entries.delete(id);
        if (activeId === id) {
            activeId = null;
        }
    };

    const setModes = (modes: ModeShellEntry[]) => {
        const incoming = new Set<string>();
        for (const mode of modes) {
            incoming.add(mode.id);
            const existing = entries.get(mode.id);
            if (existing) {
                existing.mode = mode;
                existing.button.setText(mode.label);
            } else {
                ensureEntry(mode);
            }
        }
        for (const id of Array.from(entries.keys())) {
            if (!incoming.has(id)) {
                removeEntry(id);
            }
        }
        updateActive();
    };

    const setActiveMode = (id: string | null) => {
        activeId = id;
        updateActive();
        if (activeId) {
            const entry = entries.get(activeId);
            if (entry) {
                trigger.setText(entry.mode.label);
            }
        }
    };

    const setTriggerLabel = (label: string) => {
        trigger.setText(label);
    };

    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        closeMenu();
        trigger.onclick = null;
        for (const entry of entries.values()) {
            entry.button.onclick = null;
            entry.button.remove();
        }
        entries.clear();
        dropdown.remove();
    };

    return {
        setModes,
        setActiveMode,
        setTriggerLabel,
        destroy,
    };
}

type ControllerViewOptions = {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    modes: ModeShellEntry[];
    callbacks: CartographerControllerCallbacks;
};

function createControllerView(options: ControllerViewOptions): CartographerViewHandle {
    const { app, host, initialFile, modes, callbacks } = options;

    const layout = createCartographerLayout(host);
    const mapSurface = createMapSurface(layout.mapWrapper);

    const state: { modes: ModeShellEntry[]; activeId: string | null; label: string } = {
        modes: [...modes],
        activeId: modes[0]?.id ?? null,
        label: modes[0]?.label ?? DEFAULT_MODE_LABEL,
    };

    const modeController = createModeController({
        onSwitch: async (modeId, ctx) => {
            await callbacks.onModeSelect(modeId, ctx);
        },
    });

    let modeMenu: ModeMenuHandle | null = null;

    const createMenu = (slot: HTMLElement) => {
        slot.addClass("sm-cartographer__mode-slot");
        modeMenu?.destroy();
        modeMenu = createModeMenu({
            host: slot,
            initialLabel: state.label,
            onSelect: (modeId) => {
                void modeController.requestMode(modeId).catch((error) => {
                    console.error("[cartographer] failed to request mode", error);
                });
            },
        });
        modeMenu.setModes(state.modes);
        modeMenu.setActiveMode(state.activeId);
    };

    const headerHandle: MapHeaderHandle = createMapHeader(app, layout.headerHost, {
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
            createMenu(slot);
        },
    });

    if (!modeMenu) {
        createMenu(headerHandle.titleRightSlot);
    }

    const onHexClick = async (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const custom = event as CustomEvent<HexCoord>;
        if (custom.cancelable) custom.preventDefault();
        event.stopPropagation();
        await callbacks.onHexClick(custom.detail, custom);
    };
    mapSurface.mapHost.addEventListener("hex:click", onHexClick as EventListener, { passive: false });

    const setModeActive = (id: string | null) => {
        state.activeId = id;
        const activeMode = id ? state.modes.find((mode) => mode.id === id) ?? null : null;
        if (activeMode) {
            state.label = activeMode.label;
        }
        modeMenu?.setActiveMode(id);
    };

    const setModeLabel = (label: string) => {
        state.label = label;
        modeMenu?.setTriggerLabel(label);
    };

    const setModes = (nextModes: ModeShellEntry[]) => {
        state.modes = [...nextModes];
        modeMenu?.setModes(state.modes);
        const activeMode = state.activeId
            ? state.modes.find((mode) => mode.id === state.activeId)
            : null;
        if (!activeMode) {
            state.activeId = null;
            modeMenu?.setActiveMode(null);
            const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
            setModeLabel(fallbackLabel);
        } else {
            setModeLabel(activeMode.label);
        }
    };

    const destroy = () => {
        mapSurface.mapHost.removeEventListener("hex:click", onHexClick as EventListener);
        modeController.destroy();
        modeMenu?.destroy();
        modeMenu = null;
        headerHandle.destroy();
        mapSurface.destroy();
        layout.destroy();
    };

    return {
        host,
        mapHost: mapSurface.mapHost,
        sidebarHost: layout.sidebarHost,
        setFileLabel: (file) => {
            headerHandle.setFileLabel(file);
        },
        setModeActive,
        setModeLabel,
        setModes,
        setOverlay: (content) => {
            mapSurface.setOverlay(content);
        },
        clearMap: () => {
            mapSurface.clear();
        },
        destroy,
    };
}
