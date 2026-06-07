package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.corridor.CorridorEndpointResolution.ResolvedEndpointResult;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class CorridorCreationBinding {
    private static final long NO_ROOM_ID = 0L;
    private static final long NO_CORRIDOR_ID = 0L;

    Corridor bindEndpoints(
            ResolvedEndpointResult startResolved,
            ResolvedEndpointResult endResolved,
            int level
    ) {
        Corridor corridor = new Corridor(
                nextCorridorId(endResolved.map()),
                endResolved.map().metadata().mapId().value(),
                level,
                roomIds(startResolved, endResolved),
                CorridorBindingState.empty());
        corridor = startResolved.applyTo(corridor);
        return endResolved.applyTo(corridor);
    }

    StairCollection corridorBoundStairs(
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end,
            List<Cell> routeCells,
            ResolvedEndpointResult endResolved,
            Corridor corridor
    ) {
        StairCollection nextStairs = endResolved.map().stairs();
        if (!start.sameLevelAs(end)) {
            Cell upperExit = new Cell(
                    routeCells.getLast().q(),
                    routeCells.getLast().r(),
                    end.level());
            return nextStairs.withCorridorBoundStair(
                    stairId,
                    endResolved.map().metadata().mapId().value(),
                    corridor.corridorId(),
                    routeCells,
                    upperExit);
        }
        return nextStairs;
    }

    private static List<Long> roomIds(
            ResolvedEndpointResult startResolved,
            ResolvedEndpointResult endResolved
    ) {
        List<Long> roomIds = new ArrayList<>();
        addRoomId(roomIds, startResolved.endpoint().roomId());
        addRoomId(roomIds, endResolved.endpoint().roomId());
        return List.copyOf(roomIds);
    }

    private static void addRoomId(List<Long> roomIds, @Nullable Long roomId) {
        if (persistedRoomId(roomId) && !roomIds.contains(roomId)) {
            roomIds.add(roomId);
        }
    }

    private static boolean persistedRoomId(@Nullable Long roomId) {
        return roomId != null && roomId > NO_ROOM_ID;
    }

    private static long nextCorridorId(DungeonMap dungeonMap) {
        long result = NO_CORRIDOR_ID;
        for (Corridor corridor : dungeonMap.corridors()) {
            if (corridor != null && corridor.corridorId() > result) {
                result = corridor.corridorId();
            }
        }
        return result + 1L;
    }
}
