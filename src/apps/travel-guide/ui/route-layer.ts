// Reines UI-Wrapping: delegiert Render & Highlight vollständig an draw-route.

import type { RouteNode } from "../domain/types";
import { drawRoute, updateHighlight } from "../render/draw-route";

export function createRouteLayer(
    svgRoot: SVGSVGElement,
    centerOf: (rc: { r: number; c: number }) => { x: number; y: number } | null
) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.classList.add("tg-route-layer");
    svgRoot.appendChild(el);

    function draw(route: RouteNode[], highlightIndex: number | null = null) {
        drawRoute({ layer: el, route, centerOf, highlightIndex });
    }

    function highlight(i: number | null) {
        updateHighlight(el, i);
    }

    function destroy() {
        el.remove();
    }

    return { el, draw, highlight, destroy };
}
