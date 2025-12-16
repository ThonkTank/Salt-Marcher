// src/core/hex-mapper/render/interactions.ts
import { coordToKey, pixelToAxial } from "@geometry";
import type {
    HexCoord,
    HexInteractionController,
    HexInteractionDelegate,
    HexInteractionOutcome,
} from "./rendering-types";

export type InteractionControllerConfig = {
    svg: SVGSVGElement;
    overlay: SVGRectElement;
    contentG: SVGGElement;
    base: HexCoord;
    radius: number;
    padding: number;
    host: HTMLElement;
};

const keyOf = coordToKey;

type PaintStepResult = { outcome: HexInteractionOutcome; coord: HexCoord | null };

export function createInteractionController(config: InteractionControllerConfig): HexInteractionController {
    const { svg, overlay, contentG, base, radius, padding } = config;

    // Coordinate translation (integrated from coordinates.ts)
    const svgPoint = svg.createSVGPoint();

    const toContentPoint = (ev: MouseEvent | PointerEvent): DOMPoint | null => {
        const matrix = contentG.getScreenCTM();
        if (!matrix) return null;
        svgPoint.x = ev.clientX;
        svgPoint.y = ev.clientY;
        return svgPoint.matrixTransform(matrix.inverse());
    };

    const pointToCoord = (px: number, py: number): HexCoord => {
        // Convert from canvas coordinates (with padding) to raw pixel coords
        const rawX = px - padding;
        const rawY = py - padding - radius; // Account for center offset (size = radius)

        // Use standard pixelToAxial conversion
        const relative = pixelToAxial(rawX, rawY, radius);

        // Adjust for base offset
        return { q: relative.q + base.q, r: relative.r + base.r };
    };

    // Direct callback for hex clicks
    let onHexClick: ((coord: HexCoord, ev: MouseEvent) => HexInteractionOutcome | Promise<HexInteractionOutcome>) | null = null;

    // Delegate for paint callbacks (onPaintStep, onPaintEnd)
    const delegateRef = { current: null as HexInteractionDelegate | null };

    const setDelegate = (delegate: HexInteractionDelegate | null) => {
        delegateRef.current = delegate;
    };

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
        const handler = getDelegate()?.onPaintStep;
        if (!handler) return { outcome: "default", coord };
        const outcome = await handler(coord, ev);
        return { outcome, coord };
    }

    const onClick = async (ev: MouseEvent) => {
        ev.preventDefault();
        const coord = convert(ev);
        if (!coord) return;
        if (onHexClick) {
            await onHexClick(coord, ev);
        }
    };

    const onPointerDown = (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        if (!getDelegate()?.onPaintStep) return;
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
        getDelegate()?.onPaintEnd?.();
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

    return {
        setDelegate,
        setHexClickCallback(cb) {
            onHexClick = cb;
        },
        destroy() {
            svg.removeEventListener("click", onClick as EventListener);
            svg.removeEventListener("pointerdown", onPointerDown as EventListener);
            svg.removeEventListener("pointermove", onPointerMove as EventListener);
            svg.removeEventListener("pointerup", endPaint as EventListener);
            svg.removeEventListener("pointercancel", onPointerCancel as EventListener);
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
