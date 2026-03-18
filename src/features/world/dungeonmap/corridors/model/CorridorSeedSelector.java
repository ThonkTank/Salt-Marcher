package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.ConnectionCandidate;
import features.world.dungeonmap.corridors.model.CorridorPlanningResolver.CorridorPlanningContext;

import java.util.Comparator;
import java.util.List;

final class CorridorSeedSelector {

    private CorridorSeedSelector() {
        throw new AssertionError("No instances");
    }

    static List<DungeonRoom> orderedSeedRooms(CorridorPlanningContext context) {
        return context.rooms().stream()
                .sorted(Comparator
                        .comparingInt((DungeonRoom room) -> seedWaypointScore(context, room))
                        .thenComparingInt(room -> centralityScore(room, context.rooms()))
                        .thenComparingLong(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                .toList();
    }

    private static int seedWaypointScore(CorridorPlanningContext context, DungeonRoom room) {
        if (context.waypointCells().isEmpty()) {
            return 0;
        }
        ConnectionCandidate candidate = CorridorConnectionCandidateFactory.bestPathFromRoomToTargets(
                context,
                room,
                context.waypointCells(),
                false);
        return candidate == null ? Integer.MAX_VALUE : candidate.routeScore();
    }

    private static int centralityScore(DungeonRoom room, List<DungeonRoom> rooms) {
        int total = 0;
        for (DungeonRoom other : rooms) {
            if (room == other) {
                continue;
            }
            total += CorridorPathfinder.manhattan(room.componentAnchor(), other.componentAnchor());
        }
        return total;
    }
}
