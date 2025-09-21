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

import { createTravelLogic } from "../domain/actions";
import type { Coord } from "../domain/types";

export type TravelGuideController = {
    destroy(): void;
    setFile?(file: TFile | null): void;
};

export async function mountTravelGuide(
    app: App,
    host: HTMLElement,
    file: TFile | null
): Promise<TravelGuideController | undefined> {
    host.empty();
    if (!file) return;

    // SVG-Root (für Route/Token-Layer)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    host.appendChild(svg);

    // Terrain laden
    setTerrains(await loadTerrains(app));

    // Map-Layer (stellt centerOf/ensurePolys + polyIndex)
    const opts = parseOptions("radius: 42");
    const mapLayer = await createMapLayer(app, host, file, opts);

    // Route-/Token-Layer
    const routeLayer = createRouteLayer(svg, (rc) => mapLayer.centerOf(rc));
    const tokenLayer = createTokenLayer(svg);

    // Adapter (Domain <-> UI)
    const adapter: RenderAdapter = {
        ensurePolys: (coords) => mapLayer.ensurePolys(coords),
        centerOf: (rc) => mapLayer.centerOf(rc),
        draw: (route) => routeLayer.draw(route),
        token: tokenLayer,
    };

    // Domain-Logik
    const logic = createTravelLogic({
        app,
        getMapFile: () => file,
        baseMs: 900,
        adapter,
        onChange: () => {
            const s = logic.getState();
            routeLayer.draw(s.route, s.editIdx ?? null);
        },
    });

    // Token aus Tiles laden/anzeigen (Persistenz bleibt in der Domain)
    await logic.initTokenFromTiles();

    // Drag-Controller (Ghost + Commit → Domain-Actions)
    const drag = createDragController({
        routeLayerEl: routeLayer.el,
        tokenEl: (tokenLayer as any).el as SVGGElement,
        token: tokenLayer,
        adapter,
        logic: {
            getState: () => logic.getState(),
            selectDot: (i) => logic.selectDot(i),
            moveSelectedTo: (rc) => logic.moveSelectedTo(rc),
            moveTokenTo: (rc) => logic.moveTokenTo(rc),
        },
        polyToCoord: mapLayer.polyToCoord,
    });
    drag.bind();

    // RMB-Kontextmenü (nur user-Punkte löschen)
    const unbindContext = bindContextMenu(routeLayer.el, {
        getState: () => logic.getState(),
        deleteUserAt: (idx) => logic.deleteUserAt(idx),
    });

    // hex:click → neuen user-Punkt setzen (Click nach Drag wird unterdrückt)
    const onHexClick = (ev: any) => {
        if (drag.consumeClickSuppression()) return;
        const { r, c } = ev.detail as Coord;
        logic.handleHexClick({ r, c });
    };
    const clickTarget: any = (mapLayer as any).el ?? host;
    clickTarget.addEventListener?.("hex:click", onHexClick, { passive: false });

    // Cleanup
    const controller: TravelGuideController = {
        destroy() {
            clickTarget.removeEventListener?.("hex:click", onHexClick as any);
            unbindContext();
            drag.unbind();
            tokenLayer.destroy?.();
            mapLayer.destroy();
            host.empty();
        },
    };

    return controller;
}
