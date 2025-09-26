// src/core/hex-mapper/render/interactions.ts
import type { HexCoord, HexInteractionDelegate, HexInteractionOutcome, Destroyable } from "./types";

export type InteractionControllerConfig = {
    svg: SVGSVGElement;
    overlay: SVGRectElement;
    toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;
    pointToCoord(x: number, y: number): HexCoord;
    delegateRef: { current: HexInteractionDelegate };
    onDefaultClick(coord: HexCoord, ev: MouseEvent): void | Promise<void>;
};

const keyOf = (coord: HexCoord) => `${coord.r},${coord.c}`;

type PaintStepResult = { outcome: HexInteractionOutcome; coord: HexCoord | null };

export function createInteractionController(config: InteractionControllerConfig): Destroyable {
    const { svg, overlay, toContentPoint, pointToCoord, delegateRef, onDefaultClick } = config;

    let painting = false;
    let visited: Set<string> | null = null;
    let raf = 0;
    let lastPointer: PointerEvent | null = null;

    const getDelegate = () => delegateRef.current;

    function convert(ev: MouseEvent | PointerEvent): HexCoord | null {
        const pt = toContentPoint(ev);
        if (!pt) return null;
        return pointToCoord(pt.x, pt.y);
    }

    async function executePaintStep(ev: PointerEvent): Promise<PaintStepResult> {
        const coord = convert(ev);
        if (!coord) return { outcome: "handled", coord: null };
        if (painting && visited?.has(keyOf(coord))) {
            return { outcome: "handled", coord };
        }
        const handler = getDelegate().onPaintStep;
        if (!handler) return { outcome: "default", coord };
        const outcome = await handler(coord, ev);
        return { outcome, coord };
    }

    const onClick = async (ev: MouseEvent) => {
        ev.preventDefault();
        const coord = convert(ev);
        if (!coord) return;
        const handler = getDelegate().onClick;
        const outcome = handler ? await handler(coord, ev) : "default";
        if (outcome === "default") {
            await onDefaultClick(coord, ev);
        }
    };

    const onPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        if (!getDelegate().onPaintStep) return;
        lastPointer = ev;
        void (async () => {
            const { outcome, coord } = await executePaintStep(ev);
            if (outcome === "start-paint" && coord) {
                painting = true;
                visited = new Set<string>([keyOf(coord)]);
                (svg as any).setPointerCapture?.(ev.pointerId);
                ev.preventDefault();
            } else if (outcome !== "default") {
                ev.preventDefault();
            }
        })();
    };

    const runQueuedPaintStep = () => {
        if (!painting || !lastPointer) return;
        const ev = lastPointer;
        void (async () => {
            const { outcome, coord } = await executePaintStep(ev);
            if (!painting) return;
            if (coord && outcome !== "default") {
                visited?.add(keyOf(coord));
            }
        })();
    };

    const onPointerMove = (ev: PointerEvent) => {
        if (!painting) return;
        lastPointer = ev;
        if (!raf) {
            raf = requestAnimationFrame(() => {
                raf = 0;
                runQueuedPaintStep();
            });
        }
        ev.preventDefault();
    };

    const endPaint = (ev: PointerEvent) => {
        if (!painting) return;
        painting = false;
        visited?.clear();
        visited = null;
        lastPointer = null;
        if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
        (svg as any).releasePointerCapture?.(ev.pointerId);
        getDelegate().onPaintEnd?.();
        ev.preventDefault();
    };

    const onPointerCancel = (ev: PointerEvent) => {
        if (!painting) return;
        endPaint(ev);
    };

    svg.addEventListener("click", onClick, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown, { capture: true });
    svg.addEventListener("pointermove", onPointerMove, { capture: true });
    svg.addEventListener("pointerup", endPaint, { capture: true });
    svg.addEventListener("pointercancel", onPointerCancel, { capture: true });
    overlay.addEventListener("pointerdown", onPointerDown, { capture: true });
    overlay.addEventListener("pointermove", onPointerMove, { capture: true });
    overlay.addEventListener("pointerup", endPaint, { capture: true });
    overlay.addEventListener("pointercancel", onPointerCancel, { capture: true });

    return {
        destroy() {
            svg.removeEventListener("click", onClick as EventListener);
            svg.removeEventListener("pointerdown", onPointerDown as EventListener);
            svg.removeEventListener("pointermove", onPointerMove as EventListener);
            svg.removeEventListener("pointerup", endPaint as EventListener);
            svg.removeEventListener("pointercancel", onPointerCancel as EventListener);
            overlay.removeEventListener("pointerdown", onPointerDown as EventListener);
            overlay.removeEventListener("pointermove", onPointerMove as EventListener);
            overlay.removeEventListener("pointerup", endPaint as EventListener);
            overlay.removeEventListener("pointercancel", onPointerCancel as EventListener);
            if (raf) {
                cancelAnimationFrame(raf);
                raf = 0;
            }
            painting = false;
            visited?.clear();
            visited = null;
            lastPointer = null;
        },
    };
}
