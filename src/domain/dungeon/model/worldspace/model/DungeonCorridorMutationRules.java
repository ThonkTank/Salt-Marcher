package src.domain.dungeon.model.worldspace.model;

import org.jspecify.annotations.Nullable;

final class DungeonCorridorMutationRules {

    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();

    boolean sameClusterOnly(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (start == null || end == null || !start.isDoorEndpoint() || !end.isDoorEndpoint()) {
            return false;
        }
        DungeonRoom left = LOOKUP_SERVICE.room(dungeonMap, start.roomId());
        DungeonRoom right = LOOKUP_SERVICE.room(dungeonMap, end.roomId());
        return left != null && right != null && left.clusterId() == right.clusterId();
    }

    boolean hasPersistedRoomId(@Nullable Long roomId) {
        return roomId != null && roomId > 0L;
    }

    boolean invalidCorridorId(long corridorId) {
        return corridorId <= 0L;
    }

    long nextCorridorId(DungeonMap dungeonMap) {
        long result = 0L;
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            if (corridor != null && corridor.corridorId() > result) {
                result = corridor.corridorId();
            }
        }
        return result + 1L;
    }
}
