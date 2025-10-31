// Basis-Typen & Snapshots (UI-agnostisch)

export type Coord = { r: number; c: number };
export type NodeKind = "user" | "auto";
export type RouteNode = Coord & { kind: NodeKind };

export type LogicStateSnapshot = {
    tokenRC: Coord;
    route: RouteNode[];        // nur Wegpunkte NACH tokenRC
    editIdx: number | null;
    tokenSpeed: number;        // Party speed in mph
    currentTile: Coord | null; // Fortschritt beim Abspielen
    playing: boolean;
    tempo?: number;            // playback tempo (hours per real second)
    clockHours?: number;       // accumulated in-game hours since start
    partyLevel?: number;       // Party average level for encounters (default: 1)
    partySize?: number;        // Party size for encounters (default: 4)
};
