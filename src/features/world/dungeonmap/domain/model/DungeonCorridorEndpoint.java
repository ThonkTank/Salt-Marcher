package features.world.dungeonmap.domain.model;

public sealed interface DungeonCorridorEndpoint
        permits DungeonCorridorEndpoint.Room, DungeonCorridorEndpoint.Corridor {

    static DungeonCorridorEndpoint room(long roomId) {
        return new Room(roomId);
    }

    static DungeonCorridorEndpoint corridor(long corridorId) {
        return new Corridor(corridorId);
    }

    record Room(long roomId) implements DungeonCorridorEndpoint {
    }

    record Corridor(long corridorId) implements DungeonCorridorEndpoint {
    }
}
