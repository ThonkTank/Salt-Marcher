package features.world.dungeonmap.domain.model;

public sealed interface DungeonSelection
        permits DungeonSelection.RoomCluster, DungeonSelection.Corridor {

    static DungeonSelection roomCluster(long clusterId) {
        return new RoomCluster(clusterId);
    }

    static DungeonSelection corridor(long corridorId) {
        return new Corridor(corridorId);
    }

    default boolean selectsRoomCluster(Long clusterId) {
        return this instanceof RoomCluster selection && clusterId != null && selection.clusterId() == clusterId;
    }

    default boolean selectsCorridor(Long corridorId) {
        return this instanceof Corridor selection && corridorId != null && selection.corridorId() == corridorId;
    }

    record RoomCluster(long clusterId) implements DungeonSelection {
    }

    record Corridor(long corridorId) implements DungeonSelection {
    }
}
