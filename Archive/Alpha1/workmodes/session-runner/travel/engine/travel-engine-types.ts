// Basis-Typen & Snapshots (UI-agnostisch)

import type { AxialCoord } from "@geometry";

export type Coord = AxialCoord; // { q: number; r: number }
export type NodeKind = "user" | "auto";
export type RouteNode = Coord & { kind: NodeKind };

export type LogicStateSnapshot = {
    tokenCoord: Coord;
    route: RouteNode[];        // nur Wegpunkte NACH tokenCoord
    editIdx: number | null;
    tokenSpeed: number;        // Party speed in mph
    currentTile: Coord | null; // Fortschritt beim Abspielen
    playing: boolean;
    tempo?: number;            // playback tempo (hours per real second)
    // Party data now managed by shared party-store (src/services/state/party-store.ts)
};
