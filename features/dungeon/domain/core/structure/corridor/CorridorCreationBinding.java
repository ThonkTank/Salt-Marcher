package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorEndpointResolution.ResolvedEndpointResult;
import features.dungeon.domain.core.structure.stair.StairCollection;
import features.dungeon.domain.core.structure.stair.CorridorBoundStairGeometry;

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
                CorridorBindings.empty());
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
            return CorridorBoundStairGeometry.fromRoute(routeCells, end.level())
                    .map(geometry -> nextStairs.withCorridorBoundStair(
                            stairId,
                            endResolved.map().metadata().mapId().value(),
                            corridor.corridorId(),
                            geometry.path(),
                            geometry.upperExit()))
                    .orElse(nextStairs);
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
