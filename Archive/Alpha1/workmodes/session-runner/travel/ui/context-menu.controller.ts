// Context-menu handling for travel route dots.
// UI-only module: delegates actions to the travel logic port.

import { Menu } from "obsidian";
import type { ContextMenuLogicPort } from './calendar-types';

export function bindContextMenu(routeLayerEl: SVGGElement, logic: ContextMenuLogicPort): () => void {
    const onContextMenu = (ev: MouseEvent) => {
        const target = ev.target;
        if (!(target instanceof SVGElement)) return;

        const dot = target.closest<SVGElement>(".tg-route-dot, .tg-route-dot-hitbox");
        if (!dot) return;

        const idxAttr = dot.getAttribute("data-idx");
        if (!idxAttr) return;

        const idx = Number(idxAttr);
        if (!Number.isFinite(idx) || idx < 0) return;

        const route = logic.getState().route;
        const node = route[idx];
        if (!node) return;

        const allowDelete = node.kind === "user";
        const canTriggerEncounter = typeof logic.triggerEncounterAt === "function";

        if (!allowDelete && !canTriggerEncounter) {
            return;
        }

        ev.preventDefault();
        ev.stopPropagation();

        const menu = new Menu();
        if (allowDelete) {
            menu.addItem((item) =>
                item
                    .setTitle("Wegpunkt entfernen")
                    .setIcon("trash")
                    .onClick(() => {
                        logic.deleteUserAt(idx);
                    }),
            );
        }

        if (canTriggerEncounter) {
            menu.addItem((item) =>
                item
                    .setTitle("Encounter hier starten")
                    .setIcon("sparkles")
                    .onClick(() => {
                        void logic.triggerEncounterAt?.(idx);
                    }),
            );
        }

        menu.showAtMouseEvent(ev);
    };

    routeLayerEl.addEventListener("contextmenu", onContextMenu, { capture: true });
    return () => routeLayerEl.removeEventListener("contextmenu", onContextMenu as any, { capture: true } as any);
}
