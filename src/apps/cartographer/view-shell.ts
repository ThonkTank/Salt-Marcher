// src/apps/cartographer/view-shell.ts
// Shell: Layout + Mode-Wiring für den Cartographer-View.

import type { App, TFile } from "obsidian";
import { parseOptions, type HexOptions } from "../../core/options";
import { getFirstHexBlock } from "../../core/map-list";
import type { RenderHandles } from "../../core/hex-mapper/hex-render";
import { createMapLayer, type MapLayer } from "../travel-guide/ui/map-layer";
import { createMapHeader, type MapHeaderHandle, type MapHeaderSaveMode } from "../../ui/map-header";
import { createTravelGuideMode } from "./modes/travel-guide";
import { createEditorMode } from "./modes/editor";
import { createInspectorMode } from "./modes/inspector";

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
        ctx: CartographerModeContext
    ): void | Promise<void>;
    onHexClick?(coord: HexCoord, event: CustomEvent<HexCoord>, ctx: CartographerModeContext): void | Promise<void>;
    onSave?(mode: MapHeaderSaveMode, file: TFile | null, ctx: CartographerModeContext): void | Promise<void | boolean> | boolean;
}

export type CartographerController = {
    destroy(): Promise<void> | void;
    setFile(file: TFile | null): Promise<void>;
    setMode(id: string): Promise<void>;
};

type ModeButton = {
    mode: CartographerMode;
    button: HTMLButtonElement;
};

export async function mountCartographer(
    app: App,
    host: HTMLElement,
    initialFile: TFile | null
): Promise<CartographerController> {
    host.empty();
    host.classList.add("sm-cartographer");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const body = host.createDiv({ cls: "sm-cartographer__body" });

    const mapHost = body.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = body.createDiv({ cls: "sm-cartographer__sidebar" });

    let currentFile: TFile | null = initialFile ?? null;
    let headerHandle: MapHeaderHandle | null = null;
    let mapLayer: MapLayer | null = null;
    let destroyed = false;
    let loadToken = 0;
    let activeMode: CartographerMode | null = null;
    let modeChange = Promise.resolve();
    const modeButtons: ModeButton[] = [];
    let currentOptions: HexOptions | null = null;

    const modeCtx: CartographerModeContext = {
        app,
        host,
        mapHost,
        sidebarHost,
        getFile: () => currentFile,
        getMapLayer: () => mapLayer,
        getRenderHandles: () => mapLayer?.handles ?? null,
        getOptions: () => currentOptions,
    };

    const modes: CartographerMode[] = [
        createTravelGuideMode(),
        createEditorMode(),
        createInspectorMode(),
        createNotesMode(),
    ];

    const onHexClick = async (event: Event) => {
        const ev = event as CustomEvent<HexCoord>;
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        if (!activeMode?.onHexClick) return;
        await activeMode.onHexClick(ev.detail, ev, modeCtx);
    };
    mapHost.addEventListener("hex:click", onHexClick as EventListener, { passive: false });

    async function teardownLayer() {
        if (mapLayer) {
            try {
                mapLayer.destroy();
            } catch (err) {
                console.error("[cartographer] failed to destroy map layer", err);
            }
            mapLayer = null;
        }
        mapHost.empty();
        currentOptions = null;
    }

    async function switchMode(id: string) {
        const next = modes.find((m) => m.id === id) ?? modes[0];
        if (activeMode?.id === next.id) return;
        modeChange = modeChange.then(async () => {
            if (destroyed) return;
            try {
                await activeMode?.onExit();
            } catch (err) {
                console.error("[cartographer] mode exit failed", err);
            }
            activeMode = next;
            for (const { mode, button } of modeButtons) {
                const isActive = mode.id === next.id;
                button.classList.toggle("is-active", isActive);
                button.ariaPressed = isActive ? "true" : "false";
            }
            try {
                await next.onEnter(modeCtx);
                await next.onFileChange(currentFile, mapLayer?.handles ?? null, modeCtx);
            } catch (err) {
                console.error("[cartographer] mode enter failed", err);
            }
        });
        await modeChange;
    }

    async function loadHexOptions(file: TFile): Promise<HexOptions | null> {
        const block = await getFirstHexBlock(app, file);
        if (!block) return null;
        return parseOptions(block);
    }

    async function renderMap(token: number) {
        await teardownLayer();

        if (!currentFile) {
            mapHost.createDiv({ cls: "sm-cartographer__empty", text: "Keine Karte ausgewählt." });
            currentOptions = null;
            await activeMode?.onFileChange(null, null, modeCtx);
            return;
        }

        let opts: HexOptions | null = null;
        try {
            opts = await loadHexOptions(currentFile);
        } catch (err) {
            console.error("[cartographer] failed to parse map options", err);
        }
        if (!opts) {
            mapHost.createDiv({
                cls: "sm-cartographer__empty",
                text: "Kein hex3x3-Block in dieser Datei.",
            });
            currentOptions = null;
            await activeMode?.onFileChange(currentFile, null, modeCtx);
            return;
        }

        try {
            const layer = await createMapLayer(app, mapHost, currentFile, opts);
            if (destroyed || token !== loadToken) {
                layer.destroy();
                return;
            }
            mapLayer = layer;
            currentOptions = opts;
            await activeMode?.onFileChange(currentFile, mapLayer.handles, modeCtx);
        } catch (err) {
            console.error("[cartographer] failed to render map", err);
            mapHost.createDiv({
                cls: "sm-cartographer__empty",
                text: "Karte konnte nicht geladen werden.",
            });
            currentOptions = null;
            await activeMode?.onFileChange(currentFile, null, modeCtx);
        }
    }

    async function refresh() {
        const token = ++loadToken;
        await renderMap(token);
    }

    async function setFile(file: TFile | null) {
        currentFile = file;
        headerHandle?.setFileLabel(file);
        await refresh();
    }

    headerHandle = createMapHeader(app, headerHost, {
        title: "Cartographer",
        initialFile,
        onOpen: async (file) => {
            await setFile(file);
        },
        onCreate: async (file) => {
            await setFile(file);
        },
        onSave: async (mode, file) => {
            if (!activeMode?.onSave) return false;
            try {
                const handled = await activeMode.onSave(mode, file, modeCtx);
                return handled === true;
            } catch (err) {
                console.error("[cartographer] mode onSave failed", err);
                return false;
            }
        },
        titleRightSlot: (slot) => {
            slot.classList.add("sm-cartographer__mode-switch");
            for (const mode of modes) {
                const button = slot.createEl("button", { text: mode.label, attr: { type: "button" } });
                button.onclick = () => {
                    void switchMode(mode.id);
                };
                button.ariaPressed = "false";
                modeButtons.push({ mode, button });
            }
        },
    });

    headerHandle.setFileLabel(currentFile);

    await switchMode(modes[0].id);
    await refresh();

    async function destroy() {
        if (destroyed) return;
        destroyed = true;
        mapHost.removeEventListener("hex:click", onHexClick as EventListener);
        await modeChange;
        try {
            await activeMode?.onExit();
        } catch (err) {
            console.error("[cartographer] mode exit during destroy failed", err);
        }
        activeMode = null;
        await teardownLayer();
        headerHandle?.destroy();
        headerHandle = null;
        host.empty();
        host.removeClass("sm-cartographer");
    }

    return {
        destroy,
        setFile,
        setMode: async (id: string) => {
            await switchMode(id);
        },
    };
}

function createNotesMode(): CartographerMode {
    let panel: HTMLElement | null = null;
    let message: HTMLElement | null = null;
    return {
        id: "notes",
        label: "Notes",
        async onEnter(ctx) {
            ctx.sidebarHost.empty();
            panel = ctx.sidebarHost.createDiv({ cls: "sm-cartographer__panel" });
            panel.createEl("h3", { text: "Notes" });
            panel.createEl("p", {
                text: "Dieser Modus ist ein Platzhalter für weitere Werkzeuge.",
            });
            message = panel.createEl("div", { cls: "sm-cartographer__panel-info" });
        },
        async onExit() {
            panel?.remove();
            panel = null;
            message = null;
        },
        async onFileChange(file, handles, ctx) {
            if (!panel) return;
            panel.toggleClass("is-disabled", !file || !handles);
            if (!file || !handles) {
                message?.setText("Map-Modi benötigen eine geladene Karte.");
            } else {
                message?.setText("Hex auf der Karte anklicken, um Notizen zu sammeln.");
            }
        },
        async onHexClick(coord, _event, ctx) {
            if (!message) return;
            message.setText(`Hex ausgewählt: r${coord.r}, c${coord.c}`);
        },
    };
}
