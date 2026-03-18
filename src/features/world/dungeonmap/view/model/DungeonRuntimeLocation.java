package features.world.dungeonmap.view.model;

import features.world.dungeonmap.layout.model.DungeonLayout;

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

    default boolean matchesRoom(Long roomId) {
        return this instanceof Room location && roomId != null && location.roomId() == roomId;
    }

    default boolean matchesCorridor(Long corridorId) {
        return this instanceof Corridor location && corridorId != null && location.corridorId() == corridorId;
    }

    default boolean matchesCorridorComponent(String componentId) {
        return this instanceof CorridorComponent location
                && componentId != null
                && componentId.equals(location.componentId());
    }

    record Room(long roomId) implements DungeonRuntimeLocation {
    }

    record Corridor(long corridorId) implements DungeonRuntimeLocation {
    }

    record CorridorComponent(String componentId) implements DungeonRuntimeLocation {
        public CorridorComponent {
            if (componentId == null) {
                throw new IllegalArgumentException("componentId darf nicht null sein");
            }
        }
    }
}
