// Context-menu handling for removing user-created travel route dots.
// UI-only module: delegates deletions to the travel logic port.

import type { ContextMenuLogicPort } from "./types";

export function bindContextMenu(routeLayerEl: SVGGElement, logic: ContextMenuLogicPort): () => void {
    const onContextMenu = (ev: MouseEvent) => {
        const target = ev.target;
        if (!(target instanceof SVGCircleElement)) return;

        const idxAttr = target.getAttribute("data-idx");
        if (!idxAttr) return;

        const idx = Number(idxAttr);
        if (!Number.isFinite(idx) || idx < 0) return;

        const route = logic.getState().route;
        const node = route[idx];
        if (!node) return;

        // Only allow user-generated nodes to be removed via context menu.
        if (node.kind !== "user") {
            ev.preventDefault();
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();
        logic.deleteUserAt(idx);
    };

    routeLayerEl.addEventListener("contextmenu", onContextMenu, { capture: true });
    return () => routeLayerEl.removeEventListener("contextmenu", onContextMenu as any, { capture: true } as any);
}
