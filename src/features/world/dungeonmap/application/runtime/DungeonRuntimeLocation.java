package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.CubePoint;

public sealed interface DungeonRuntimeLocation
        permits DungeonRuntimeLocation.Room, DungeonRuntimeLocation.Corridor, DungeonRuntimeLocation.CorridorComponent, DungeonRuntimeLocation.Tile, DungeonRuntimeLocation.StairExit {

    static DungeonRuntimeLocation room(long roomId) {
        return new Room(roomId);
    }

    static DungeonRuntimeLocation corridor(long corridorId) {
        return new Corridor(corridorId);
    }

    static DungeonRuntimeLocation corridorComponent(String componentId) {
        return new CorridorComponent(componentId);
    }

    static DungeonRuntimeLocation tile(CubePoint tile) {
        return new Tile(tile);
    }

    static DungeonRuntimeLocation stairExit(long stairId, CubePoint tile) {
        return new StairExit(stairId, tile);
    }

    record Room(long roomId) implements DungeonRuntimeLocation {
    }

    record Corridor(long corridorId) implements DungeonRuntimeLocation {
    }

    record CorridorComponent(String componentId) implements DungeonRuntimeLocation {
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
}
