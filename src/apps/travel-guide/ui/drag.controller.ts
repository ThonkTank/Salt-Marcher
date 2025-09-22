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

    function getDotElements(idx: number) {
        const dot = routeLayerEl.querySelector<SVGCircleElement>(`.tg-route-dot[data-idx="${idx}"]`);
        const hit = routeLayerEl.querySelector<SVGCircleElement>(`.tg-route-dot-hitbox[data-idx="${idx}"]`);
        return { dot, hit };
    }

    function ghostMoveSelectedDot(rc: Coord) {
        const s = logic.getState();
        const idx = s.editIdx;
        if (idx == null) return;
        const { dot, hit } = getDotElements(idx);
        if (!dot) return;
        const ctr = adapter.centerOf(rc);
        if (!ctr) return;
        dot.setAttribute("cx", String(ctr.x));
        dot.setAttribute("cy", String(ctr.y));
        if (hit) {
            hit.setAttribute("cx", String(ctr.x));
            hit.setAttribute("cy", String(ctr.y));
        }
    }

    function ghostMoveToken(rc: Coord) {
        const ctr = adapter.centerOf(rc);
        if (!ctr) return;
        token.setPos(ctr.x, ctr.y);
        token.show();
    }

    // Event handlers -----------------------------------------------------------

    const onGlobalPointerDownCapture = (ev: PointerEvent) => {
        if (ev.button !== 0) return;

        const check = (el: EventTarget | null | undefined): boolean => {
            if (!(el instanceof Element)) return false;
            if (el === tokenEl || tokenEl.contains(el)) return true;
            if (el instanceof SVGCircleElement && routeLayerEl.contains(el)) return true;
            return false;
        };

        const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
        if (Array.isArray(path) && path.length > 0) {
            for (const el of path) {
                if (check(el)) {
                    suppressNextHexClick = true;
                    return;
                }
            }
        } else if (check(ev.target)) {
            suppressNextHexClick = true;
        }
    };

    const onDotPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return; // nur LMB
        const t = ev.target as Element;
        if (!(t instanceof SVGCircleElement)) return;
        if (!t.classList.contains("tg-route-dot") && !t.classList.contains("tg-route-dot-hitbox")) return;

        const idxAttr = t.getAttribute("data-idx");
        const idx = idxAttr ? Number(idxAttr) : NaN;
        if (!Number.isFinite(idx) || idx < 0) return;

        logic.selectDot(idx);
        dragKind = "dot";
        isDragging = true;
        lastDragRC = null;
        suppressNextHexClick = true;
        disableLayerHit(true);
        const { dot } = getDotElements(idx);
        (dot ?? t).setPointerCapture?.(ev.pointerId);

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
            window.addEventListener("pointerdown", onGlobalPointerDownCapture, { capture: true });
            routeLayerEl.addEventListener("pointerdown", onDotPointerDown, { capture: true });
            tokenEl.addEventListener("pointerdown", onTokenPointerDown, { capture: true });
            window.addEventListener("pointermove", onPointerMove, { passive: true });
            window.addEventListener("pointerup", onPointerUp, { passive: true });
            window.addEventListener("pointercancel", onPointerCancel, { passive: true });
        }

        function unbind() {
            window.removeEventListener("pointerdown", onGlobalPointerDownCapture as any, { capture: true } as any);
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
