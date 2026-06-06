package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;

final class DungeonCorridorMutationRules {

    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    boolean sameClusterOnly(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (start == null || end == null || !start.isDoorEndpoint() || !end.isDoorEndpoint()) {
            return false;
        }
        DungeonRoom left = LOOKUP_ADAPTER.room(dungeonMap, start.roomId());
        DungeonRoom right = LOOKUP_ADAPTER.room(dungeonMap, end.roomId());
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
