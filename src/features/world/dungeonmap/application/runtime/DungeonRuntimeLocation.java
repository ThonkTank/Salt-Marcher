package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CubePoint;

/**
 * Runtime state should point at direct playable locations, not at editor-only sub-aggregates.
 */
public sealed interface DungeonRuntimeLocation
        permits DungeonRuntimeLocation.Room, DungeonRuntimeLocation.Corridor, DungeonRuntimeLocation.Tile, DungeonRuntimeLocation.StairExit, DungeonRuntimeLocation.Transition {

    static DungeonRuntimeLocation room(long roomId) {
        return new Room(roomId);
    }

    static DungeonRuntimeLocation corridor(long corridorId) {
        return new Corridor(corridorId, null);
    }

    static DungeonRuntimeLocation corridor(long corridorId, CubePoint anchorTile) {
        return new Corridor(corridorId, anchorTile);
    }

    static DungeonRuntimeLocation tile(CubePoint tile) {
        return new Tile(tile);
    }

    static DungeonRuntimeLocation stairExit(long stairId, CubePoint tile) {
        return new StairExit(stairId, tile);
    }

    static DungeonRuntimeLocation transition(long transitionId) {
        return new Transition(transitionId);
    }

    record Room(long roomId) implements DungeonRuntimeLocation {
    }

    record Corridor(long corridorId, CubePoint anchorTile) implements DungeonRuntimeLocation {
        public Corridor {
            anchorTile = anchorTile == null ? null : anchorTile;
        }
    }

    record Tile(CubePoint tile) implements DungeonRuntimeLocation {
        public Tile {
            tile = tile == null ? new CubePoint(0, 0, 0) : tile;
        }
    }

    record StairExit(long stairId, CubePoint tile) implements DungeonRuntimeLocation {
        public StairExit {
            tile = tile == null ? new CubePoint(0, 0, 0) : tile;
        }
    }

    record Transition(long transitionId) implements DungeonRuntimeLocation {
    }
}
