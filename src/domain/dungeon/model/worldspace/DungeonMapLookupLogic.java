package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;

public final class DungeonMapLookupLogic {

    public @Nullable DungeonRoom room(DungeonMap dungeonMap, long roomId) {
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room;
            }
        }
        return null;
    }

    public @Nullable DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }

    public @Nullable DungeonCorridor corridor(DungeonMap dungeonMap, long corridorId) {
        for (DungeonCorridor candidate : dungeonMap.connections().corridors()) {
            if (candidate != null && candidate.corridorId() == corridorId) {
                return candidate;
            }
        }
        return null;
    }
}
