// Reines Rendering von Polyline + Dots inkl. zentralem Highlighting.

import type { RouteNode } from "../domain/types";

type C = { r: number; c: number };
type CtrFn = (rc: C) => { x: number; y: number } | null;

export function drawRoute(args: {
    layer: SVGGElement;
    route: RouteNode[];
    centerOf: CtrFn;
    highlightIndex?: number | null;
}) {
    const { layer, route, centerOf, highlightIndex = null } = args;

    // clear
    while (layer.firstChild) layer.removeChild(layer.firstChild);

    // collect points
    const pts: string[] = [];
    const centers: Array<{ x: number; y: number } | null> = route.map((n) => centerOf(n));
    for (const p of centers) if (p) pts.push(`${p.x},${p.y}`);

    // polyline
    if (pts.length >= 2) {
        const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        pl.setAttribute("points", pts.join(" "));
        pl.setAttribute("fill", "none");
        pl.setAttribute("stroke", "var(--interactive-accent)");
        pl.setAttribute("stroke-width", "3");
        pl.setAttribute("stroke-linejoin", "round");
        pl.setAttribute("stroke-linecap", "round");
        pl.style.pointerEvents = "none";
        layer.appendChild(pl);
    }

    // dots
    route.forEach((node, i) => {
        const ctr = centers[i];
        if (!ctr) return;
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", String(ctr.x));
        dot.setAttribute("cy", String(ctr.y));
        dot.setAttribute("r", node.kind === "user" ? "5" : "4");
        dot.setAttribute("fill", "var(--interactive-accent)");
        dot.setAttribute("opacity", node.kind === "user" ? "1" : "0.55");
        dot.setAttribute("data-kind", node.kind);
        dot.style.pointerEvents = "auto";
        layer.appendChild(dot);
    });

    // initial highlight (optional)
    updateHighlight(layer, highlightIndex);
}

export function updateHighlight(layer: SVGGElement, highlightIndex: number | null) {
    const dots = Array.from(layer.querySelectorAll<SVGCircleElement>("circle"));
    dots.forEach((el, idx) => {
        const isHi = highlightIndex != null && idx === highlightIndex;
        el.setAttribute("stroke", isHi ? "var(--background-modifier-border)" : "none");
        el.setAttribute("stroke-width", isHi ? "2" : "0");
        el.setAttribute("r", isHi ? String(Number(el.getAttribute("r") || "4") + 2) : (el.dataset.kind === "user" ? "5" : "4"));
        el.style.opacity = el.getAttribute("data-kind") === "user" ? (isHi ? "1" : "1") : (isHi ? "0.9" : "0.55");
        el.style.cursor = "pointer";
    });
}
