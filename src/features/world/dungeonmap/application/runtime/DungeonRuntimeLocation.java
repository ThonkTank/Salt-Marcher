package features.world.dungeonmap.application.runtime;

public sealed interface DungeonRuntimeLocation
        permits DungeonRuntimeLocation.Room, DungeonRuntimeLocation.Corridor, DungeonRuntimeLocation.CorridorComponent {

    static DungeonRuntimeLocation room(long roomId) {
        return new Room(roomId);
    }

    static DungeonRuntimeLocation corridor(long corridorId) {
        return new Corridor(corridorId);
    }

    static DungeonRuntimeLocation corridorComponent(String componentId) {
        return new CorridorComponent(componentId);
    }

    record Room(long roomId) implements DungeonRuntimeLocation {
    }

    record Corridor(long corridorId) implements DungeonRuntimeLocation {
    }

    record CorridorComponent(String componentId) implements DungeonRuntimeLocation {
    }
}
