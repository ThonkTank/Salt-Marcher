package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.topology.ResolvedDoorOverride;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class CorridorExitFinder {

    record ExitCandidate(
            Point2i roomCell,
            Point2i outsideCell,
            Point2i direction,
            DoorSegment door
    ) {}

    private CorridorExitFinder() {
        throw new AssertionError("No instances");
    }

    static List<ExitCandidate> exitCandidatesForRoom(long roomId, CorridorPlanningContext context) {
        DungeonRoom room = context.roomsById().get(roomId);
        if (room == null) {
            return List.of();
        }
        return exposedExits(
                context.roomCells(roomId),
                context.roomOccupancy(),
                roomId,
                context.doorOverride(room));
    }

    static List<ExitCandidate> exposedExits(
            Set<Point2i> roomCells,
            Map<Point2i, Long> roomOccupancy,
            long roomId,
            ResolvedDoorOverride override
    ) {
        List<ExitCandidate> result = new ArrayList<>();
        for (Point2i cell : roomCells) {
            for (Point2i direction : CorridorRouteGeometry.CARDINAL_NEIGHBORS) {
                Point2i outside = cell.add(direction);
                if (roomCells.contains(outside)) {
                    continue;
                }
                if (roomOccupancy.containsKey(outside)) {
                    continue;
                }
                DoorSegment door = CorridorRouteGeometry.doorFor(cell, direction, roomId);
                if (!CorridorPlanningResolver.matchesOverride(door, override)) {
                    continue;
                }
                result.add(new ExitCandidate(cell, outside, direction, door));
            }
        }
        // Exit ordering is only a deterministic fallback after the anchor-aware connection scoring.
        result.sort(Comparator
                .comparingInt((ExitCandidate candidate) -> candidate.outsideCell().x())
                .thenComparingInt(candidate -> candidate.outsideCell().y())
                .thenComparingInt(candidate -> candidate.direction().x())
                .thenComparingInt(candidate -> candidate.direction().y()));
        return result;
    }
}
