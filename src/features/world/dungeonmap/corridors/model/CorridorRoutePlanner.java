package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorBuildState;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningContext;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningOrdering;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class CorridorRoutePlanner {

    private CorridorRoutePlanner() {
        throw new AssertionError("No instances");
    }

    // Multi-room corridors stay deterministic and bounded: we build one shared corridor from a stable seed room,
    // then pick each next room by the added pair-travel it contributes into that shared network.
    static CorridorGeometry planCorridorGeometry(
            DungeonLayout layout,
            DungeonCorridor corridor,
            List<DungeonRoom> rooms,
            Map<Long, Set<Point2i>> roomCellsById,
            Map<Point2i, Long> roomOccupancy
    ) {
        Long corridorId = corridor == null ? null : corridor.corridorId();
        List<DungeonRoom> groupRooms = normalizedRooms(rooms);
        List<Long> roomIds = groupRooms.stream().map(DungeonRoom::roomId).toList();
        if (groupRooms.size() < 2) {
            return new CorridorGeometry(corridorId, roomIds, List.of(), Set.of(), List.of(), List.of(), false, false, null);
        }

        CorridorPlanningContext context = CorridorPlanningContext.create(
                layout,
                corridor,
                groupRooms,
                roomCellsById,
                roomOccupancy);

        // Auto doors without explicit overrides may move on every recompute so the whole corridor network can
        // shorten after room moves instead of preserving stale local attachments.
        CorridorBuildState bestState = CorridorSeedSelector.orderedSeedRooms(context).stream()
                .map(seedRoom -> CorridorNetworkBuilder.buildSeedState(context, seedRoom, roomIds))
                .min(CorridorPlanningOrdering.buildStateComparator())
                .orElseThrow(() -> new IllegalStateException("Keine Seed-Raeume fuer Korridor-Geometrie"));

        return toCorridorGeometry(corridorId, roomIds, context.waypointCells(), bestState, groupRooms.size());
    }

    private static List<DungeonRoom> normalizedRooms(List<DungeonRoom> rooms) {
        return rooms.stream()
                .filter(Objects::nonNull)
                .filter(room -> room.roomId() != null)
                .distinct()
                .toList();
    }

    private static CorridorGeometry toCorridorGeometry(
            Long corridorId,
            List<Long> roomIds,
            List<Point2i> waypointCells,
            CorridorBuildState bestState,
            int totalRoomCount
    ) {
        boolean routable = bestState.connectedRoomCount() == totalRoomCount
                && (!bestState.segments().isEmpty() || !bestState.doors().isEmpty());
        return new CorridorGeometry(
                corridorId,
                roomIds,
                List.copyOf(bestState.segments()),
                Set.copyOf(bestState.corridorCells()),
                List.copyOf(bestState.doors()),
                List.copyOf(waypointCells),
                bestState.directlyAdjacentOnly(),
                routable,
                null);
    }
}
