package src.domain.dungeon.map.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;

final class DungeonCorridorMutationRules {

    private static final int MULTI_CLUSTER_THRESHOLD = 1;
    private static final DungeonMapLookupService LOOKUP_SERVICE = new DungeonMapLookupService();

    boolean sameClusterOnly(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (!(start instanceof DungeonCorridorDoorEndpoint startDoor)
                || !(end instanceof DungeonCorridorDoorEndpoint endDoor)) {
            return false;
        }
        DungeonRoom left = LOOKUP_SERVICE.room(dungeonMap, startDoor.roomId());
        DungeonRoom right = LOOKUP_SERVICE.room(dungeonMap, endDoor.roomId());
        return left != null && right != null && left.clusterId() == right.clusterId();
    }

    boolean sameClusterOnly(DungeonMap dungeonMap, List<Long> roomIds) {
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            DungeonRoom room = roomId == null ? null : LOOKUP_SERVICE.room(dungeonMap, roomId);
            if (room == null) {
                continue;
            }
            clusterIds.add(room.clusterId());
            if (clusterIds.size() > MULTI_CLUSTER_THRESHOLD) {
                return false;
            }
        }
        return clusterIds.size() <= MULTI_CLUSTER_THRESHOLD;
    }

    boolean hasPersistedRoomId(@Nullable Long roomId) {
        return roomId != null && roomId > 0L;
    }

    boolean invalidCorridorId(long corridorId) {
        return corridorId <= 0L;
    }

    long nextCorridorId(DungeonMap dungeonMap) {
        return dungeonMap.connections().corridors().stream()
                .mapToLong(DungeonCorridor::corridorId)
                .max()
                .orElse(0L) + 1L;
    }
}
