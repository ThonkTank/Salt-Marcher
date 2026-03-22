package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.Point2i;

public sealed interface DungeonRuntimeLocation
        permits DungeonRuntimeLocation.Room, DungeonRuntimeLocation.Corridor, DungeonRuntimeLocation.CorridorComponent, DungeonRuntimeLocation.Tile {

    static DungeonRuntimeLocation room(long roomId) {
        return new Room(roomId);
    }

    static DungeonRuntimeLocation corridor(long corridorId) {
        return new Corridor(corridorId);
    }

    static DungeonRuntimeLocation corridorComponent(String componentId) {
        return new CorridorComponent(componentId);
    }

    static DungeonRuntimeLocation tile(Point2i tile) {
        return new Tile(tile);
    }

    record Room(long roomId) implements DungeonRuntimeLocation {
    }

    record Corridor(long corridorId) implements DungeonRuntimeLocation {
    }

    record CorridorComponent(String componentId) implements DungeonRuntimeLocation {
    }

    record Tile(Point2i tile) implements DungeonRuntimeLocation {
        public Tile {
            tile = tile == null ? new Point2i(0, 0) : tile;
        }
    }
}
