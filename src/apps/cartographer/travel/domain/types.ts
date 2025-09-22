// Basis-Typen & Snapshots (UI-agnostisch)

export type Coord = { r: number; c: number };
export type NodeKind = "user" | "auto";
export type RouteNode = Coord & { kind: NodeKind };

export type LogicStateSnapshot = {
    tokenRC: Coord;
    route: RouteNode[];        // nur Wegpunkte NACH tokenRC
    editIdx: number | null;
    tokenSpeed: number;
    currentTile: Coord | null; // Fortschritt beim Abspielen
    playing: boolean;
};
