// Reines UI-Wrapping: delegiert Render & Highlight vollständig an draw-route.

import type { Coord, RouteNode } from "../domain/types";
import { drawRoute, updateHighlight } from "../render/draw-route";

export function createRouteLayer(
    contentRoot: SVGGElement,
    centerOf: (rc: { r: number; c: number }) => { x: number; y: number } | null
) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.classList.add("tg-route-layer");
    contentRoot.appendChild(el);

    function draw(route: RouteNode[], highlightIndex: number | null = null, start?: Coord | null) {
        drawRoute({ layer: el, route, centerOf, highlightIndex, start });
    }

    function highlight(i: number | null) {
        updateHighlight(el, i);
    }

    function destroy() {
        el.remove();
    }

    return { el, draw, highlight, destroy };
}
