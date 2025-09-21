// RMB-Löschen: nur hier! UI-only, ruft deleteUserAt(idx) in der Logik.

import type { RouteNode } from "../domain/types";

type LogicPort = {
    getState(): { route: RouteNode[] };
    deleteUserAt(idx: number): void;
};

export function bindContextMenu(routeLayerEl: SVGGElement, logic: LogicPort): () => void {
    const onContextMenu = (ev: MouseEvent) => {
        const t = ev.target as Element | null;
        if (!(t instanceof SVGCircleElement)) return;

        const circles = Array.from(routeLayerEl.querySelectorAll<SVGCircleElement>("circle"));
        const idx = circles.indexOf(t);
        if (idx < 0) return;

        const route = logic.getState().route;
        const node = route[idx];
        if (!node) return;

        // Nur user-Punkte dürfen gelöscht werden
        if (node.kind !== "user") {
            ev.preventDefault(); // blockiere Browser-Menü, aber keine Aktion
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();
        logic.deleteUserAt(idx);
    };

    routeLayerEl.addEventListener("contextmenu", onContextMenu, { capture: true });
    return () => routeLayerEl.removeEventListener("contextmenu", onContextMenu as any, { capture: true } as any);
}
