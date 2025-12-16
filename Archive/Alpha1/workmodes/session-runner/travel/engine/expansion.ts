// src/workmodes/session-runner/travel/engine/expansion.ts
// Hilfsfunktionen zur Routen-Interpolation.
import { line } from "@geometry";
import type { Coord, RouteNode } from './calendar-types';

/** Liefert Pfad EXKL. Start, INKL. Ende (keine Duplikate am Start) */
export function expandCoords(a: Coord, b: Coord): Coord[] {
    // Coords are already in axial format {q, r}
    const seg = line(a, b); // inkl. beider Endpunkte

    if (seg.length <= 1) return [];
    seg.shift(); // Start weg
    return seg;
}

/** Entfernt aufeinanderfolgende Duplikate (q,r) */
export function dedupeCoords(list: Coord[]): Coord[] {
    const out: Coord[] = [];
    let prev: Coord | null = null;
    for (const p of list) {
        if (!prev || p.q !== prev.q || p.r !== prev.r) out.push(p);
        prev = p;
    }
    return out;
}

/** Baut RouteNodes zwischen Anchors neu (tokenCoord -> firstUser -> nextUser ...) */
export function rebuildFromAnchors(tokenCoord: Coord, anchors: Coord[]): RouteNode[] {
    const route: RouteNode[] = [];
    let cur = tokenCoord;

    for (let i = 0; i < anchors.length; i++) {
        const next = anchors[i];
        const seg = expandCoords(cur, next); // EXKL start, INKL next
        const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
        route.push(...autos);
        // letzer Schritt als user (Anchor selbst)
        route.push(asUserNode(next));
        cur = next;
    }

    return route;
}

export const asUserNode = (coord: Coord): RouteNode => ({ ...coord, kind: "user" });
export const asAutoNode = (coord: Coord): RouteNode => ({ ...coord, kind: "auto" });
