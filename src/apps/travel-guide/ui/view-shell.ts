// src/apps/travel-guide/ui/view-shell.ts
// Shell: Layout + Wiring. Keine UI-States; liest immer aus logic.getState().
// Delegiert Pointer/RMB an Controller; Domain erledigt Regeln & Persistenz.

import type { App, TFile } from "obsidian";
import { parseOptions } from "../../../core/options";
import { loadTerrains } from "../../../core/terrain-store";
import { setTerrains } from "../../../core/terrain";

import type { RenderAdapter } from "../infra/adapter";
import { createMapLayer } from "./map-layer";
import { createRouteLayer } from "./route-layer";
import { createTokenLayer } from "./token-layer";
import { createDragController } from "./drag.controller";
import { bindContextMenu } from "./contextmenue";
import { createSidebar } from "./sidebar";

import { createTravelLogic } from "../domain/actions";
import type { Coord, LogicStateSnapshot } from "../domain/types";

export type TravelGuideController = {
    destroy(): void;
    setFile?(file: TFile | null): Promise<void>;
};

export async function mountTravelGuide(
    app: App,
    host: HTMLElement,
    file: TFile | null
): Promise<TravelGuideController | undefined> {
    host.empty();
    host.classList.add("sm-travel-guide");

    const mapHost = host.createDiv({ cls: "sm-tg-map" });
    const sidebarHost = host.createDiv({ cls: "sm-tg-sidebar" });

    const sidebar = createSidebar(sidebarHost, file?.basename ?? "—");

    await setTerrains(await loadTerrains(app));

    const opts = parseOptions("radius: 42");

    let currentFile: TFile | null = null;
    let mapLayer: Awaited<ReturnType<typeof createMapLayer>> | null = null;
    let routeLayer: ReturnType<typeof createRouteLayer> | null = null;
    let tokenLayer: ReturnType<typeof createTokenLayer> | null = null;
    let drag: ReturnType<typeof createDragController> | null = null;
    let unbindContext: () => void = () => {};
    let logic: ReturnType<typeof createTravelLogic> | null = null;
    let isDestroyed = false;
    let loadChain = Promise.resolve();

    const handleStateChange = (s: LogicStateSnapshot) => {
        if (routeLayer) routeLayer.draw(s.route, s.editIdx ?? null, s.tokenRC ?? null);
        sidebar.setTile(s.currentTile ?? s.tokenRC ?? null);
        sidebar.setSpeed(s.tokenSpeed);
    };

    const cleanupInteractions = () => {
        unbindContext();
        unbindContext = () => {};
        if (drag) {
            drag.unbind();
            drag = null;
        }
    };

    const cleanupLayers = () => {
        cleanupInteractions();
        if (tokenLayer) {
            tokenLayer.destroy?.();
            tokenLayer = null;
        }
        if (routeLayer) {
            routeLayer.destroy();
            routeLayer = null;
        }
        if (mapLayer) {
            mapLayer.destroy();
            mapLayer = null;
        }
        mapHost.empty();
    };

    const onHexClick = (ev: CustomEvent<Coord>) => {
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        if (!logic) return;
        if (drag?.consumeClickSuppression()) return;
        const { r, c } = ev.detail;
        logic.handleHexClick({ r, c });
    };
    mapHost.addEventListener("hex:click", onHexClick as any, { passive: false });

    const loadFile = async (nextFile: TFile | null) => {
        if (isDestroyed) return;
        const same = nextFile?.path === currentFile?.path;
        if (same) return;

        currentFile = nextFile;
        sidebar.setTitle(nextFile?.basename ?? "—");
        sidebar.setTile(null);

        logic?.pause?.();
        logic = null;

        cleanupLayers();

        if (!nextFile) {
            sidebar.setSpeed(1);
            return;
        }

        mapLayer = await createMapLayer(app, mapHost, nextFile, opts);
        if (isDestroyed) {
            mapLayer.destroy();
            mapLayer = null;
            return;
        }

        routeLayer = createRouteLayer(mapLayer.handles.svg, (rc) => mapLayer!.centerOf(rc));
        tokenLayer = createTokenLayer(mapLayer.handles.svg);

        const adapter: RenderAdapter = {
            ensurePolys: (coords) => mapLayer!.ensurePolys(coords),
            centerOf: (rc) => mapLayer!.centerOf(rc),
            draw: (route, tokenRC) => routeLayer!.draw(route, null, tokenRC),
            token: tokenLayer!,
        };

        logic = createTravelLogic({
            app,
            baseMs: 900,
            getMapFile: () => currentFile,
            adapter,
            onChange: (state) => handleStateChange(state),
        });

        handleStateChange(logic.getState());
        await logic.initTokenFromTiles();
        if (isDestroyed) return;

        drag = createDragController({
            routeLayerEl: routeLayer!.el,
            tokenEl: (tokenLayer as any).el as SVGGElement,
            token: tokenLayer!,
            adapter,
            logic: {
                getState: () => logic!.getState(),
                selectDot: (i) => logic!.selectDot(i),
                moveSelectedTo: (rc) => logic!.moveSelectedTo(rc),
                moveTokenTo: (rc) => logic!.moveTokenTo(rc),
            },
            polyToCoord: mapLayer!.polyToCoord,
        });
        drag.bind();

        unbindContext = bindContextMenu(routeLayer!.el, {
            getState: () => logic!.getState(),
            deleteUserAt: (idx) => logic!.deleteUserAt(idx),
        });
    };

    sidebar.onSpeedChange((v) => {
        logic?.setTokenSpeed(v);
    });

    await loadFile(file);

    const enqueueLoad = (next: TFile | null) => {
        loadChain = loadChain
            .then(() => loadFile(next))
            .catch((err) => {
                console.error("[travel-guide] setFile failed", err);
            });
        return loadChain;
    };

    const controller: TravelGuideController = {
        setFile(next) {
            return enqueueLoad(next ?? null);
        },
        destroy() {
            isDestroyed = true;
            mapHost.removeEventListener("hex:click", onHexClick as any);
            cleanupLayers();
            logic?.pause?.();
            logic = null;
            sidebar.destroy();
            host.classList.remove("sm-travel-guide");
            host.empty();
        },
    };

    return controller;
}
