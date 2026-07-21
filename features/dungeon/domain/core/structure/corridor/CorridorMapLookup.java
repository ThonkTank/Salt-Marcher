package features.dungeon.domain.core.structure.corridor;

import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class CorridorMapLookup {
    private static final long NO_CORRIDOR_ID = 0L;

    @Nullable
    static RoomRegion room(DungeonMap dungeonMap, long roomId) {
        for (RoomRegion room : dungeonMap.rooms().rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room;
            }
        }
        return null;
    }

    @Nullable
    static RoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        for (RoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null && cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }

    @Nullable
    static Corridor corridor(DungeonMap dungeonMap, long corridorId) {
        if (corridorId <= NO_CORRIDOR_ID) {
            return null;
        }
        for (Corridor candidate : dungeonMap.corridors()) {
            if (candidate != null && candidate.corridorId() == corridorId) {
                return candidate;
            }
        }
        return null;
    }

    private CorridorMapLookup() {
    }
}
