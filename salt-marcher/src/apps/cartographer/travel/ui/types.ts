// Shared UI-facing domain typings for the travel cartographer stack.
// Keeps controller modules aligned with the logic contract.

import type { Coord, RouteNode } from "../domain/types";

/**
 * Minimal state snapshot required by UI controllers that need to inspect
 * the editable travel route. The drag controller additionally relies on the
 * `editIdx` to determine which dot is under manipulation.
 */
export type RouteEditSnapshot = {
    route: RouteNode[];
    editIdx: number | null;
};

/**
 * Contract for the context-menu controller: expose the current route snapshot
 * and allow user-created dots to be removed.
 */
export type ContextMenuLogicPort = {
    getState(): Pick<RouteEditSnapshot, "route">;
    deleteUserAt(idx: number): void;
};

/**
 * Contract for the drag controller: allow selecting dots, moving them and the
 * travel token, and provide access to the editable route state.
 */
export type DragLogicPort = {
    getState(): RouteEditSnapshot;
    selectDot(idx: number | null): void;
    moveSelectedTo(rc: Coord): void;
    moveTokenTo(rc: Coord): void;
};

// Re-export the core domain coordinates to keep imports local to the UI layer.
export type { Coord, RouteNode } from "../domain/types";
