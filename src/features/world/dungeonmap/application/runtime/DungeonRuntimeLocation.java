package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CellCoord;

/**
 * Runtime state should point at direct playable locations, not at editor-only sub-aggregates.
 */
public sealed interface DungeonRuntimeLocation
        permits DungeonRuntimeLocation.Room, DungeonRuntimeLocation.Corridor, DungeonRuntimeLocation.Cell, DungeonRuntimeLocation.StairExit, DungeonRuntimeLocation.Transition {

    static DungeonRuntimeLocation room(long roomId) {
        return new Room(roomId);
    }

    static DungeonRuntimeLocation corridor(long corridorId) {
        return new Corridor(corridorId, null, 0);
    }

    static DungeonRuntimeLocation corridor(long corridorId, CellCoord anchorCell, int levelZ) {
        return new Corridor(corridorId, anchorCell, levelZ);
    }

    static DungeonRuntimeLocation cell(CellCoord cell, int levelZ) {
        return new Cell(cell, levelZ);
    }

    static DungeonRuntimeLocation stairExit(long stairId, CellCoord cell, int levelZ) {
        return new StairExit(stairId, cell, levelZ);
    }

    static DungeonRuntimeLocation transition(long transitionId) {
        return new Transition(transitionId);
    }

    record Room(long roomId) implements DungeonRuntimeLocation {
    }

    record Corridor(long corridorId, CellCoord anchorCell, int levelZ) implements DungeonRuntimeLocation {
    }

    record Cell(CellCoord cell, int levelZ) implements DungeonRuntimeLocation {
    }

    record StairExit(long stairId, CellCoord cell, int levelZ) implements DungeonRuntimeLocation {
    }

    record Transition(long transitionId) implements DungeonRuntimeLocation {
    }
}
