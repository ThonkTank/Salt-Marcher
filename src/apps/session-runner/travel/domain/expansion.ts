// src/apps/session-runner/travel/domain/expansion.ts
// Hilfsfunktionen zur Routen-Interpolation.
import { lineOddR } from "../../../../core/hex-mapper/hex-geom";
import type { Coord, RouteNode } from "./types";

/** Liefert Pfad EXKL. Start, INKL. Ende (keine Duplikate am Start) */
export function expandCoords(a: Coord, b: Coord): Coord[] {
    const seg = lineOddR(a, b); // inkl. beider Endpunkte
    if (seg.length <= 1) return [];
    seg.shift(); // Start weg
    return seg;
}

/** Entfernt aufeinanderfolgende Duplikate (r,c) */
export function dedupeCoords(list: Coord[]): Coord[] {
    const out: Coord[] = [];
    let prev: Coord | null = null;
    for (const p of list) {
        if (!prev || p.r !== prev.r || p.c !== prev.c) out.push(p);
        prev = p;
    }
    return out;
}

/** Baut RouteNodes zwischen Anchors neu (tokenRC -> firstUser -> nextUser ...) */
export function rebuildFromAnchors(tokenRC: Coord, anchors: Coord[]): RouteNode[] {
    const route: RouteNode[] = [];
    let cur = tokenRC;

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

export const asUserNode = (rc: Coord): RouteNode => ({ ...rc, kind: "user" });
export const asAutoNode = (rc: Coord): RouteNode => ({ ...rc, kind: "auto" });
