// Zentrale Drag-Steuerung: Dot-/Token-Drag, Ghost-Preview, Commit.
// UI-only: keine Business-Regeln hier – Commit ruft Logik-API.

import type { Coord, DragLogicPort } from './calendar-types';
import type { TokenCtl, RenderAdapter } from "../infra/adapter";

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
    logic: DragLogicPort;                          // Logik-API (Commit)
    polyToCoord: WeakMap<SVGElement, Coord>;       // MapLayer-Index
}): DragController {
    const { routeLayerEl, tokenEl, token, adapter, logic, polyToCoord } = deps;

    let isDragging = false;
    let dragKind: "dot" | "token" | null = null;
    let lastDragRC: Coord | null = null;
    let suppressNextHexClick = false;
    let pointerCaptureOwner: Element | null = null;
    let activePointerId: number | null = null;

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

    function capturePointer(el: Element | null, pointerId: number) {
        if (!el || typeof (el as Element & { setPointerCapture?: unknown }).setPointerCapture !== "function") {
            pointerCaptureOwner = null;
            activePointerId = null;
            return;
        }
        try {
            (el as Element & { setPointerCapture(id: number): void }).setPointerCapture(pointerId);
            pointerCaptureOwner = el;
            activePointerId = pointerId;
        } catch {
            pointerCaptureOwner = null;
            activePointerId = null;
        }
    }

    function releasePointerCapture() {
        if (!pointerCaptureOwner || activePointerId == null) {
            pointerCaptureOwner = null;
            activePointerId = null;
            return;
        }
        const el = pointerCaptureOwner as Element & { releasePointerCapture?(id: number): void };
        try {
            el.releasePointerCapture?.(activePointerId);
        } catch {}
        pointerCaptureOwner = null;
        activePointerId = null;
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
        capturePointer(dot ?? t, ev.pointerId);

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
        capturePointer(tokenEl, ev.pointerId);

        ev.preventDefault();
        (ev as any).stopImmediatePropagation?.();
        ev.stopPropagation();
    };

    const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging) return;
        if ((ev.buttons & 1) === 0) {
            endDrag();
            return;
        }

        const poly = findPolygonAt(ev.clientX, ev.clientY);
        if (!poly) return;
        const rc = polyToCoord.get(poly);
        if (!rc) return;

        if (lastDragRC && rc.q === lastDragRC.q && rc.r === lastDragRC.r) return;
        lastDragRC = rc;

        if (dragKind === "dot") ghostMoveSelectedDot(rc);
        else if (dragKind === "token") ghostMoveToken(rc);
    };

    function endDrag() {
        if (!isDragging) {
            releasePointerCapture();
            return;
        }
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
        releasePointerCapture();
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
        releasePointerCapture();
    }

    function consumeClickSuppression(): boolean {
        if (isDragging) return true;
        if (!suppressNextHexClick) return false;
        suppressNextHexClick = false;
        return true;
    }

    return { bind, unbind, consumeClickSuppression };
}
