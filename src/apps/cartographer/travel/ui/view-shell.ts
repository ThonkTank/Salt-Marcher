// src/apps/travel-guide/ui/view-shell.ts
// Shell: Layout + Wiring. Keine UI-States; liest immer aus logic.getState().
// Delegiert Pointer/RMB an Controller; Domain erledigt Regeln & Persistenz.

import type { App, TFile } from "obsidian";
import { parseOptions } from "../../../../core/options";
import { saveMap, saveMapAs } from "../../../../core/save";
import type { Coord } from "../domain/types";
import { createMapLayer, type MapLayer } from "./map-layer";
import {
    createMapHeader,
    type MapHeaderHandle,
    type MapHeaderSaveMode,
} from "../../../../ui/map-header";
import { createTravelGuideMode } from "../../modes/travel-guide";
import type { CartographerModeContext } from "../../view-shell";

export type TravelGuideController = {
    destroy(): void | Promise<void>;
    setFile?(file: TFile | null): Promise<void>;
};

export async function mountTravelGuide(
    app: App,
    host: HTMLElement,
    file: TFile | null
): Promise<TravelGuideController | undefined> {
    host.empty();
    host.classList.add("sm-cartographer", "sm-cartographer--travel");

    const headerHost = host.createDiv({ cls: "sm-cartographer__header" });
    const body = host.createDiv({ cls: "sm-cartographer__body" });

    const mapHost = body.createDiv({ cls: "sm-cartographer__map" });
    const sidebarHost = body.createDiv({
        cls: "sm-cartographer__sidebar sm-cartographer__sidebar--travel",
    });

    const travelMode = createTravelGuideMode();

    const opts = parseOptions("radius: 42");

    let headerHandle: MapHeaderHandle | null = null;
    let currentFile: TFile | null = null;
    let mapLayer: MapLayer | null = null;
    let isDestroyed = false;
    let loadChain = Promise.resolve();

    const modeCtx: CartographerModeContext = {
        app,
        host,
        mapHost,
        sidebarHost,
        getFile: () => currentFile,
        getMapLayer: () => mapLayer,
        getRenderHandles: () => mapLayer?.handles ?? null,
    };

    await travelMode.onEnter(modeCtx);

    const onHexClick = async (event: Event) => {
        const ev = event as CustomEvent<Coord>;
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        if (!travelMode.onHexClick) return;
        await travelMode.onHexClick(ev.detail, ev, modeCtx);
    };
    mapHost.addEventListener("hex:click", onHexClick as EventListener, {
        passive: false,
    });

    const cleanupMap = async () => {
        if (mapLayer) {
            mapLayer.destroy();
            mapLayer = null;
        }
        mapHost.empty();
        await travelMode.onFileChange(null, null, modeCtx);
    };

    const loadFile = async (nextFile: TFile | null) => {
        if (isDestroyed) return;
        const same = nextFile?.path === currentFile?.path;
        if (same) return;

        currentFile = nextFile;
        headerHandle?.setFileLabel(currentFile);

        await cleanupMap();

        if (!nextFile) return;

        const layer = await createMapLayer(app, mapHost, nextFile, opts);
        if (isDestroyed) {
            layer.destroy();
            return;
        }

        mapLayer = layer;
        await travelMode.onFileChange(nextFile, mapLayer.handles, modeCtx);
    };

    const enqueueLoad = (next: TFile | null) => {
        loadChain = loadChain
            .then(() => loadFile(next))
            .catch((err) => {
                console.error("[travel-guide] setFile failed", err);
            });
        return loadChain;
    };

    const handleSave = async (
        mode: MapHeaderSaveMode,
        current: TFile | null
    ): Promise<boolean> => {
        if (travelMode.onSave) {
            try {
                const handled = await travelMode.onSave(mode, current, modeCtx);
                if (handled === true) return true;
            } catch (err) {
                console.error("[travel-guide] mode onSave failed", err);
            }
        }
        if (!current) return false;
        if (mode === "save") {
            await saveMap(app, current);
        } else {
            await saveMapAs(app, current);
        }
        return true;
    };

    headerHandle = createMapHeader(app, headerHost, {
        title: "Travel Guide",
        initialFile: file ?? null,
        onOpen: async (next) => {
            await enqueueLoad(next);
        },
        onCreate: async (created) => {
            await enqueueLoad(created);
        },
        onSave: handleSave,
    });

    await enqueueLoad(file ?? null);

    const controller: TravelGuideController = {
        setFile(next) {
            return enqueueLoad(next ?? null);
        },
        async destroy() {
            if (isDestroyed) return;
            isDestroyed = true;
            mapHost.removeEventListener("hex:click", onHexClick as EventListener);
            await loadChain;
            await cleanupMap();
            await travelMode.onExit();
            headerHandle?.destroy();
            headerHandle = null;
            host.classList.remove("sm-cartographer", "sm-cartographer--travel");
            host.empty();
        },
    };

    return controller;
}
