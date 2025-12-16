// Schlanke Brücke zwischen UI-Renderern (map/route/token) und Domain-Logik.

import type { Coord, RouteNode } from "../engine/travel-engine-types";

export type TokenCtl = {
    setPos(x: number, y: number): void;
    moveTo(x: number, y: number, durMs: number): Promise<void> | void;
    stop?(): void;
    show(): void;
    hide(): void;
    destroy?: () => void;
};

export type RenderAdapter = {
    /** Map-Layer: Polygone sicherstellen (und indexieren) */
    ensurePolys(coords: Coord[]): void;

    /** Map-Layer: Mittelpunkt eines Hex in Pixelkoordinaten */
    centerOf(rc: Coord): { x: number; y: number } | null;

    /** Route-Layer: Route zeichnen (nur Rendering) */
    draw(route: RouteNode[], tokenCoord: Coord): void;

    /** Token-Layer: Sichtbarer Token */
    token: TokenCtl;
};
