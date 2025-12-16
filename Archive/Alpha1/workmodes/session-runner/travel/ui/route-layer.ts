// Reines UI-Wrapping: delegiert Render & Highlight vollständig an draw-route.

import { drawRoute, updateHighlight } from "../render/draw-route";
import type { Coord, RouteNode } from "../engine/travel-engine-types";

export function createRouteLayer(
    contentRoot: SVGGElement,
    centerOf: (coord: { q: number; r: number }) => { x: number; y: number } | null
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
