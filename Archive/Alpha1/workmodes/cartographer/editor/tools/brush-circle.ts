// src/workmodes/cartographer/editor/tools/brush-circle.ts

export type BrushCircleController = {
    updateRadius: (units: number) => void; // Radius in Hex-Einheiten (1 == R)
    show: () => void;
    hide: () => void;
    destroy: () => void;
};

type Handles = { svg: SVGSVGElement; contentG: SVGGElement; overlay: SVGRectElement };
type Opts = { initialRadius: number; hexRadiusPx: number };

/**
 * Vorschaukreis für den Brush. Hört auf pointermove am Overlay (funktioniert mit Pointer-Capture),
 * transformiert mit getScreenCTM() ins contentG und throttlet Updates via requestAnimationFrame.
 */
export function attachBrushCircle(handles: Handles, opts: Opts): BrushCircleController {
    const { svg, contentG, overlay } = handles;

    // Skalierung: pointy-top Hex → vStep = 1.5 * R, hStep = sqrt(3) * R
    // Use average of vertical and horizontal spacing for symmetric visual circle
    const R = opts.hexRadiusPx;
    const vStep = 1.5 * R;                        // Vertical spacing between hex centers
    const hStep = Math.sqrt(3) * R;               // Horizontal spacing (≈1.732 * R)
    const avgStep = (vStep + hStep) / 2;          // Average ≈1.616 * R
    const toPx = (d: number) => Math.max(0, d) * avgStep; // Symmetric radius in all directions

    // Kreis
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", String(toPx(opts.initialRadius)));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "var(--interactive-accent)");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("pointer-events", "none");
    circle.style.opacity = "0.6";
    contentG.appendChild(circle);

    // Re-usable SVGPoint
    const svgPt = svg.createSVGPoint();
    let lastEvt: PointerEvent | null = null;
    let raf = 0;

    function toContent(): DOMPoint | null {
        const m = contentG.getScreenCTM();
        if (!m) return null;
        return svgPt.matrixTransform(m.inverse());
    }

    function bringToFront() { contentG.appendChild(circle); }

    function tick() {
        raf = 0;
        if (!lastEvt) return;
        svgPt.x = lastEvt.clientX;
        svgPt.y = lastEvt.clientY;
        const pt = toContent();
        if (!pt) return;
        circle.setAttribute("cx", String(pt.x));
        circle.setAttribute("cy", String(pt.y));
        bringToFront();
    }

    function onPointerMove(ev: PointerEvent) {
        lastEvt = ev;
        if (!raf) raf = requestAnimationFrame(tick);
    }
    function onPointerEnter() { circle.style.opacity = "0.6"; }
    function onPointerLeave() { circle.style.opacity = "0"; }

    // Events am SVG (bubbelt durch Polygone)
    svg.addEventListener("pointermove", onPointerMove, { passive: true });
    svg.addEventListener("pointerenter", onPointerEnter, { passive: true });
    svg.addEventListener("pointerleave", onPointerLeave, { passive: true });

    function updateRadius(hexDist: number) {
        circle.setAttribute("r", String(toPx(hexDist)));
        bringToFront();
    }
    function show() { circle.style.display = ""; circle.style.opacity = "0.6"; bringToFront(); }
    function hide() { circle.style.opacity = "0"; }

    function destroy() {
        svg.removeEventListener("pointermove", onPointerMove);
        svg.removeEventListener("pointerenter", onPointerEnter);
        svg.removeEventListener("pointerleave", onPointerLeave);
        if (raf) cancelAnimationFrame(raf);
        circle.remove();
    }

    return { updateRadius, show, hide, destroy };
}


