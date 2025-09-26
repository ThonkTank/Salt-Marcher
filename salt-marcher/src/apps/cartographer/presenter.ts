// src/apps/cartographer/presenter.ts
// Presenter: Kapselt Statusverwaltung, Mode-Lifecycle und Map-Rendering für den Cartographer.

import type { App, TFile } from "obsidian";
import { parseOptions, type HexOptions } from "../../core/options";
import { getFirstHexBlock } from "../../core/map-list";
import type { RenderHandles } from "../../core/hex-mapper/hex-render";
import { createMapLayer, type MapLayer } from "./travel/ui/map-layer";
import { createMapManager, type MapManagerHandle } from "../../ui/map-manager";
import { createTravelGuideMode } from "./modes/travel-guide";
import { createEditorMode } from "./modes/editor";
import { createInspectorMode } from "./modes/inspector";
import {
    createCartographerShell,
    type CartographerShellHandle,
    type CartographerShellMode,
    type CartographerShellOptions,
    type ModeSelectContext,
} from "./view-shell";
import type { MapHeaderSaveMode } from "../../ui/map-header";

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

export interface CartographerMode {
    readonly id: string;
    readonly label: string;
    onEnter(ctx: CartographerModeContext): void | Promise<void>;
    onExit(): void | Promise<void>;
    onFileChange(
        file: TFile | null,
        handles: RenderHandles | null,
        ctx: CartographerModeContext,
    ): void | Promise<void>;
    onHexClick?(
        coord: HexCoord,
        event: CustomEvent<HexCoord>,
        ctx: CartographerModeContext,
    ): void | Promise<void>;
    onSave?(mode: MapHeaderSaveMode, file: TFile | null, ctx: CartographerModeContext): void | Promise<void | boolean> | boolean;
}

export interface CartographerPresenterDeps {
    createShell(options: CartographerShellOptions): CartographerShellHandle;
    createMapManager(app: App, options: Parameters<typeof createMapManager>[1]): MapManagerHandle;
    createMapLayer(app: App, host: HTMLElement, file: TFile, opts: HexOptions): Promise<MapLayer>;
    loadHexOptions(app: App, file: TFile): Promise<HexOptions | null>;
    provideModes(): CartographerMode[];
}

const createDefaultDeps = (app: App): CartographerPresenterDeps => ({
    createShell: (options) => createCartographerShell(options),
    createMapManager: (appInstance, options) => createMapManager(appInstance, options),
    createMapLayer: (appInstance, host, file, opts) => createMapLayer(appInstance, host, file, opts),
    loadHexOptions: async (appInstance, file) => {
        const block = await getFirstHexBlock(appInstance, file);
        if (!block) return null;
        return parseOptions(block);
    },
    provideModes: () => [createTravelGuideMode(), createEditorMode(), createInspectorMode()],
});

type ModeTransitionPhase = "idle" | "exiting" | "entering";

/**
 * Internal state machine snapshot for a mode transition. Tracks the active phase and
 * provides a dedicated abort controller so new switches can cancel in-flight work.
 */
type ModeTransition = {
    readonly id: number;
    readonly next: CartographerMode;
    readonly previous: CartographerMode | null;
    readonly controller: AbortController;
    readonly externalSignal: AbortSignal | null;
    phase: ModeTransitionPhase;
};

export class CartographerPresenter {
    private readonly app: App;
    private readonly deps: CartographerPresenterDeps;

    private shell: CartographerShellHandle | null = null;
    private mapManager: MapManagerHandle | null = null;
    private currentFile: TFile | null = null;
    private currentOptions: HexOptions | null = null;
    private mapLayer: MapLayer | null = null;
    private activeMode: CartographerMode | null = null;
    private readonly modes: CartographerMode[];
    private hostEl: HTMLElement | null = null;
    private modeChange: Promise<void> = Promise.resolve();
    private readonly transitionTasks = new Set<Promise<void>>();
    private loadToken = 0;
    private isMounted = false;
    private requestedFile: TFile | null | undefined = undefined;
    private modeTransitionSeq = 0;
    private transition: ModeTransition | null = null;

    constructor(app: App, deps?: Partial<CartographerPresenterDeps>) {
        this.app = app;
        const defaults = createDefaultDeps(app);
        this.deps = { ...defaults, ...deps } as CartographerPresenterDeps;
        this.modes = this.deps.provideModes();
    }

    /** Öffnet den Presenter auf dem übergebenen Host. */
    async onOpen(host: HTMLElement, fallbackFile: TFile | null): Promise<void> {
        await this.onClose();

        this.hostEl = host;
        const initialFile = this.requestedFile ?? fallbackFile ?? null;
        this.currentFile = initialFile;

        const shellModes: CartographerShellMode[] = this.modes.map((mode) => ({ id: mode.id, label: mode.label }));

        this.shell = this.deps.createShell({
            app: this.app,
            host,
            initialFile,
            modes: shellModes,
            callbacks: {
                onModeSelect: (id, context) => {
                    void this.setMode(id, context);
                },
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
            },
        });

        this.mapManager = this.deps.createMapManager(this.app, {
            initialFile,
            onChange: async (file) => {
                await this.handleFileChange(file);
            },
        });

        this.shell.setModeLabel(shellModes[0]?.label ?? "Mode");
        this.shell.setModeActive(shellModes[0]?.id ?? "");
        this.shell.setFileLabel(initialFile);

        this.isMounted = true;
        this.requestedFile = initialFile;

        await this.setMode(shellModes[0]?.id ?? "");
        await this.mapManager.setFile(initialFile);
    }

    /** Schließt den Presenter und räumt Ressourcen auf. */
    async onClose(): Promise<void> {
        if (!this.isMounted) {
            this.shell?.destroy();
            this.shell = null;
            this.hostEl = null;
            return;
        }

        this.isMounted = false;
        this.transition?.controller.abort();
        await this.modeChange;
        try {
            await this.activeMode?.onExit();
        } catch (err) {
            console.error("[cartographer] mode exit failed", err);
        }
        this.activeMode = null;
        await this.teardownLayer();
        this.shell?.destroy();
        this.shell = null;
        this.hostEl = null;
        this.mapManager = null;
    }

    /** Setzt (oder merkt) die gewünschte Karte. */
    async setFile(file: TFile | null): Promise<void> {
        this.requestedFile = file;
        if (!this.isMounted || !this.mapManager) return;
        await this.mapManager.setFile(file);
    }

    private get modeCtx(): CartographerModeContext {
        if (!this.shell || !this.hostEl) {
            throw new Error("CartographerPresenter is not mounted.");
        }
        return {
            app: this.app,
            host: this.hostEl,
            mapHost: this.shell.mapHost,
            sidebarHost: this.shell.sidebarHost,
            getFile: () => this.currentFile,
            getMapLayer: () => this.mapLayer,
            getRenderHandles: () => this.mapLayer?.handles ?? null,
            getOptions: () => this.currentOptions,
        } satisfies CartographerModeContext;
    }

    private async handleFileChange(file: TFile | null): Promise<void> {
        this.currentFile = file;
        this.shell?.setFileLabel(file);
        await this.refresh();
    }

    private async handleSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> {
        if (!this.activeMode?.onSave) return false;
        try {
            const handled = await this.activeMode.onSave(mode, file, this.modeCtx);
            return handled === true;
        } catch (err) {
            console.error("[cartographer] mode onSave failed", err);
            return false;
        }
    }

    private async handleHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): Promise<void> {
        if (!this.activeMode?.onHexClick) return;
        try {
            await this.activeMode.onHexClick(coord, event, this.modeCtx);
        } catch (err) {
            console.error("[cartographer] mode onHexClick failed", err);
        }
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
                // suppressed to avoid unhandled rejections if the transition unexpectedly fails
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
                this.shell?.setModeActive(next.id);
                this.shell?.setModeLabel(next.label);
            }
            return;
        }

        const transition: ModeTransition = {
            id: ++this.modeTransitionSeq,
            next,
            previous: this.activeMode,
            controller: new AbortController(),
            externalSignal,
            phase: "idle",
        };

        this.transition = transition;
        const detachAbort = this.bindExternalAbort(transition);

        try {
            const previous = transition.previous;
            if (previous) {
                const exitOutcome = await this.runTransitionStep(
                    transition,
                    "exiting",
                    () => previous.onExit(),
                    "[cartographer] mode exit failed",
                );

                if (exitOutcome === "aborted") {
                    return;
                }

                this.activeMode = null;
            }

            if (this.isTransitionAborted(transition)) {
                return;
            }

            const modeCtx = this.modeCtx;

            this.activeMode = transition.next;

            if (this.isTransitionAborted(transition)) {
                this.activeMode = null;
                return;
            }

            this.shell?.setModeActive(transition.next.id);
            this.shell?.setModeLabel(transition.next.label);

            const enterOutcome = await this.runTransitionStep(
                transition,
                "entering",
                () => transition.next.onEnter(modeCtx),
                "[cartographer] mode enter failed",
            );

            if (enterOutcome === "aborted") {
                this.activeMode = null;
                return;
            }

            if (this.isTransitionAborted(transition)) {
                this.activeMode = null;
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
                return;
            }

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
        }
    }

    private async refresh(): Promise<void> {
        const token = ++this.loadToken;
        await this.renderMap(token);
    }

    private async renderMap(token: number): Promise<void> {
        await this.teardownLayer();

        if (!this.shell) return;
        const ctx = this.modeCtx;
        const transition = this.transition;
        const isTransitionAborted = () => (transition ? this.isTransitionAborted(transition) : false);

        if (!this.currentFile) {
            this.shell.clearMap();
            this.shell.setOverlay("Keine Karte ausgewählt.");
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
            this.shell.clearMap();
            this.shell.setOverlay("Kein hex3x3-Block in dieser Datei.");
            this.currentOptions = null;
            if (!isTransitionAborted()) {
                await this.activeMode?.onFileChange(this.currentFile, null, ctx);
            }
            return;
        }

        try {
            const layer = await this.deps.createMapLayer(this.app, this.shell.mapHost, this.currentFile, options);
            if (token !== this.loadToken || !this.shell) {
                layer.destroy();
                return;
            }
            if (isTransitionAborted()) {
                layer.destroy();
                return;
            }
            this.mapLayer = layer;
            this.currentOptions = options;
            this.shell.setOverlay(null);
            if (!isTransitionAborted()) {
                await this.activeMode?.onFileChange(this.currentFile, this.mapLayer.handles, ctx);
            }
        } catch (err) {
            console.error("[cartographer] failed to render map", err);
            this.shell.clearMap();
            this.shell.setOverlay("Karte konnte nicht geladen werden.");
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
        this.shell?.clearMap();
        this.currentOptions = null;
    }
}
