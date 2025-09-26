// src/apps/cartographer/view-shell.ts
// View-Layer: rendert DOM-Struktur und leitet UI-Ereignisse an den Presenter weiter.

import type { App, TFile } from "obsidian";
import type { HexCoord } from "./presenter";
import { createMapHeader, type MapHeaderSaveMode } from "../../ui/map-header";
import { createCartographerLayout } from "./view-shell/layout";
import { createMapSurface } from "./view-shell/map-surface";
import {
    createModeController,
    type ModeControllerHandle,
    type ModeSwitchContext,
} from "./view-shell/mode-controller";
import { createModeRegistry, type ModeRegistryHandle } from "./view-shell/mode-registry";

export type CartographerShellMode = { id: string; label: string };

export type ModeSelectContext = ModeSwitchContext;

export interface CartographerShellCallbacks {
    onModeSelect(id: string, ctx?: ModeSelectContext): void | Promise<void>;
    onOpen(file: TFile): void | Promise<void>;
    onCreate(file: TFile): void | Promise<void>;
    onDelete(file: TFile): void | Promise<void>;
    onSave(mode: MapHeaderSaveMode, file: TFile | null): Promise<boolean> | boolean;
    onHexClick(coord: HexCoord, event: CustomEvent<HexCoord>): void | Promise<void>;
}

export interface CartographerShellOptions {
    app: App;
    host: HTMLElement;
    initialFile: TFile | null;
    modes: CartographerShellMode[];
    callbacks: CartographerShellCallbacks;
}

export interface CartographerShellHandle {
    readonly host: HTMLElement;
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
    setFileLabel(file: TFile | null): void;
    setModeActive(id: string): void;
    setModeLabel(label: string): void;
    setModes(modes: CartographerShellMode[]): void;
    registerMode(mode: CartographerShellMode): void;
    deregisterMode(id: string): void;
    setOverlay(content: string | null): void;
    clearMap(): void;
    destroy(): void;
}

type HexClickListener = (event: CustomEvent<HexCoord>) => void | Promise<void>;

type ModeRegistryState = {
    modes: CartographerShellMode[];
    activeId: string | null;
    label: string;
};

const DEFAULT_MODE_LABEL = "Mode";

export function createCartographerShell(options: CartographerShellOptions): CartographerShellHandle {
    const { app, host, initialFile, modes, callbacks } = options;

    const layout = createCartographerLayout(host);
    const mapSurface = createMapSurface(layout.mapWrapper);

    const state: ModeRegistryState = {
        modes: [...modes],
        activeId: modes[0]?.id ?? null,
        label: modes[0]?.label ?? DEFAULT_MODE_LABEL,
    };

    let modeRegistry: ModeRegistryHandle | null = null;
    let modeController: ModeControllerHandle | null = null;

    const ensureModeRegistry = (slot: HTMLElement) => {
        modeRegistry?.destroy();
        modeRegistry = createModeRegistry({
            host: slot,
            initialLabel: state.label,
            onSelect: (modeId) => {
                if (!modeController) return;
                void modeController.requestMode(modeId).catch((error) => {
                    console.error("[cartographer] failed to request mode", error);
                });
            },
        });
        modeRegistry.setModes(state.modes);
        modeRegistry.setActiveMode(state.activeId);
    };

    modeController = createModeController({
        onSwitch: async (modeId, ctx) => {
            await callbacks.onModeSelect(modeId, ctx);
        },
    });

    const headerHandle = createMapHeader(app, layout.headerHost, {
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
            ensureModeRegistry(slot);
        },
    });

    const onHexClick: HexClickListener = async (event) => {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        await callbacks.onHexClick(event.detail, event);
    };
    mapSurface.mapHost.addEventListener("hex:click", onHexClick as EventListener, { passive: false });

    const setModeActive = (id: string) => {
        state.activeId = id;
        const activeMode = state.modes.find((mode) => mode.id === id);
        if (activeMode) {
            state.label = activeMode.label;
        }
        modeRegistry?.setActiveMode(id);
    };

    const setModeLabel = (label: string) => {
        state.label = label;
        modeRegistry?.setTriggerLabel(label);
    };

    const setModes = (nextModes: CartographerShellMode[]) => {
        state.modes = [...nextModes];
        modeRegistry?.setModes(state.modes);
        const activeMode = state.activeId
            ? state.modes.find((mode) => mode.id === state.activeId)
            : null;
        if (!activeMode) {
            state.activeId = null;
            modeRegistry?.setActiveMode(null);
            const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
            setModeLabel(fallbackLabel);
        } else {
            setModeLabel(activeMode.label);
        }
    };

    const registerMode = (mode: CartographerShellMode) => {
        const existingIndex = state.modes.findIndex((entry) => entry.id === mode.id);
        if (existingIndex >= 0) {
            state.modes[existingIndex] = mode;
        } else {
            state.modes.push(mode);
        }
        modeRegistry?.registerMode(mode);
        if (state.activeId === mode.id) {
            setModeLabel(mode.label);
        } else if (!state.activeId) {
            const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
            setModeLabel(fallbackLabel);
        }
    };

    const deregisterMode = (id: string) => {
        state.modes = state.modes.filter((mode) => mode.id !== id);
        modeRegistry?.deregisterMode(id);
        if (state.activeId === id) {
            state.activeId = null;
            modeRegistry?.setActiveMode(null);
            const fallbackLabel = state.modes[0]?.label ?? DEFAULT_MODE_LABEL;
            setModeLabel(fallbackLabel);
        }
    };

    const destroy = () => {
        mapSurface.mapHost.removeEventListener("hex:click", onHexClick as EventListener);
        modeController?.destroy();
        modeController = null;
        modeRegistry?.destroy();
        modeRegistry = null;
        headerHandle.destroy();
        mapSurface.destroy();
        layout.destroy();
    };

    const handle: CartographerShellHandle = {
        host,
        mapHost: mapSurface.mapHost,
        sidebarHost: layout.sidebarHost,
        setFileLabel: (file) => {
            headerHandle.setFileLabel(file);
        },
        setModeActive,
        setModeLabel,
        setModes,
        registerMode,
        deregisterMode,
        setOverlay: (content) => {
            mapSurface.setOverlay(content);
        },
        clearMap: () => {
            mapSurface.clear();
        },
        destroy,
    };

    return handle;
}
