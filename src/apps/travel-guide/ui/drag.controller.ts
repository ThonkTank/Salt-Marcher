// Zentrale Drag-Steuerung: Dot-/Token-Drag, Ghost-Preview, Commit.
// UI-only: keine Business-Regeln hier – Commit ruft Logik-API.

import type { Coord } from "../domain/types";
import type { TokenCtl, RenderAdapter } from "../infra/adapter";

type LogicPort = {
    getState(): { editIdx: number | null; route: Array<Coord & { kind: string }> };
    selectDot(idx: number | null): void;
    moveSelectedTo(rc: Coord): void;
    moveTokenTo(rc: Coord): void;
};

export type DragController = {
    bind(): void;
    unbind(): void;
    /** true => der nächste hex:click soll unterdrückt werden */
    consumeClickSuppression(): boolean;
};

export function createDragController(deps: {
    routeLayerEl: SVGGElement;                     // <g> mit Dot circles
    tokenEl: SVGGElement;                          // sichtbares Token-<g>
    token: TokenCtl;                               // TokenCtl (für Ghost setPos)
adapter: RenderAdapter;                        // centerOf/ensurePolys
logic: LogicPort;                              // Logik-API (Commit)
polyToCoord: WeakMap<SVGElement, Coord>;       // MapLayer-Index
}): DragController {
    const { routeLayerEl, tokenEl, token, adapter, logic, polyToCoord } = deps;

    let isDragging = false;
    let dragKind: "dot" | "token" | null = null;
    let lastDragRC: Coord | null = null;
    let suppressNextHexClick = false;

    // Helpers ------------------------------------------------------------------

    function disableLayerHit(on: boolean) {
        // während Drag: Polylayer aus Hit-Test nehmen, damit elementFromPoint Polygone findet
        routeLayerEl.style.pointerEvents = on ? "none" : "";
    }

    function findPolygonAt(clientX: number, clientY: number): SVGElement | null {
        const el = document.elementFromPoint(clientX, clientY) as Element | null;
        if (!el) return null;
        const poly1 = (el as any).closest?.("polygon") as SVGElement | null;
        if (poly1) return poly1;
        let cur: Element | null = el;
        while (cur) {
            if (cur instanceof SVGPolygonElement) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    function ghostMoveSelectedDot(rc: Coord) {
        const s = logic.getState();
        const idx = s.editIdx;
        if (idx == null) return;
        const dots = Array.from(routeLayerEl.querySelectorAll<SVGCircleElement>("circle"));
        const dot = dots[idx];
        if (!dot) return;
        const ctr = adapter.centerOf(rc);
        if (!ctr) return;
        dot.setAttribute("cx", String(ctr.x));
        dot.setAttribute("cy", String(ctr.y));
    }

    function ghostMoveToken(rc: Coord) {
        const ctr = adapter.centerOf(rc);
        if (!ctr) return;
        token.setPos(ctr.x, ctr.y);
        token.show();
    }

    // Event handlers -----------------------------------------------------------

    const onDotPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return; // nur LMB
        const t = ev.target as Element;
        if (!(t instanceof SVGCircleElement)) return;

        const nodes = Array.from(routeLayerEl.querySelectorAll("circle"));
        const idx = nodes.indexOf(t);
        if (idx < 0) return;

        logic.selectDot(idx);
        dragKind = "dot";
        isDragging = true;
        lastDragRC = null;
        suppressNextHexClick = true;
        disableLayerHit(true);
        (t as Element).setPointerCapture?.(ev.pointerId);

        ev.preventDefault();
        (ev as any).stopImmediatePropagation?.();
        ev.stopPropagation();
    };

    const onTokenPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        dragKind = "token";
        isDragging = true;
        lastDragRC = null;
        suppressNextHexClick = true;
        disableLayerHit(true);
        tokenEl.setPointerCapture?.(ev.pointerId);

        ev.preventDefault();
        (ev as any).stopImmediatePropagation?.();
        ev.stopPropagation();
    };

    const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging) return;
        if ((ev.buttons & 1) === 0) { endDrag(); return; }

        const poly = findPolygonAt(ev.clientX, ev.clientY);
        if (!poly) return;
        const rc = polyToCoord.get(poly);
        if (!rc) return;

        if (lastDragRC && rc.r === lastDragRC.r && rc.c === lastDragRC.c) return;
        lastDragRC = rc;

        if (dragKind === "dot") ghostMoveSelectedDot(rc);
        else if (dragKind === "token") ghostMoveToken(rc);
    };

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;

            if (lastDragRC) {
                // Sicherheitsnetz: sicherstellen, dass Ziel-Poly existiert
                adapter.ensurePolys([lastDragRC]);

                if (dragKind === "dot") logic.moveSelectedTo(lastDragRC);
                else if (dragKind === "token") logic.moveTokenTo(lastDragRC);

                suppressNextHexClick = true; // Folgeklick der Maus loslassen unterdrücken
            }

            lastDragRC = null;
            dragKind = null;
            disableLayerHit(false);
        }

        const onPointerUp = () => endDrag();
        const onPointerCancel = () => endDrag();

        // Public API ---------------------------------------------------------------

        function bind() {
            routeLayerEl.addEventListener("pointerdown", onDotPointerDown, { capture: true });
            tokenEl.addEventListener("pointerdown", onTokenPointerDown, { capture: true });
            window.addEventListener("pointermove", onPointerMove, { passive: true });
            window.addEventListener("pointerup", onPointerUp, { passive: true });
            window.addEventListener("pointercancel", onPointerCancel, { passive: true });
        }

        function unbind() {
            routeLayerEl.removeEventListener("pointerdown", onDotPointerDown as any, { capture: true } as any);
            tokenEl.removeEventListener("pointerdown", onTokenPointerDown as any, { capture: true } as any);
            window.removeEventListener("pointermove", onPointerMove as any);
            window.removeEventListener("pointerup", onPointerUp as any);
            window.removeEventListener("pointercancel", onPointerCancel as any);
        }

        function consumeClickSuppression(): boolean {
            const r = suppressNextHexClick;
            suppressNextHexClick = false;
            return r;
        }

        return { bind, unbind, consumeClickSuppression };
}
