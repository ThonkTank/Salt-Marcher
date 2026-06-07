package src.domain.dungeon.model.core.structure.corridor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

final class CorridorMapLookup {
    private static final long NO_CORRIDOR_ID = 0L;

    @Nullable
    static DungeonRoom room(DungeonMap dungeonMap, long roomId) {
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.roomId() == roomId) {
                return room;
            }
        }
        return null;
    }

    @Nullable
    static DungeonRoomCluster cluster(DungeonMap dungeonMap, long clusterId) {
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
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

    static Cell clusterCenterOrOrigin(DungeonMap dungeonMap, long clusterId, int level) {
        DungeonRoomCluster target = cluster(dungeonMap, clusterId);
        return target == null ? new Cell(0, 0, level) : target.center();
    }

    private CorridorMapLookup() {
    }
}
