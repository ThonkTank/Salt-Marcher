package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalPlanRequestProjector {

    private TraversalPlanRequestProjector() {
    }

    public static TraversalPlanRequest project(Corridor corridor, CorridorPlanningInput input) {
        if (corridor == null || input == null) {
            return TraversalPlanRequest.empty();
        }
        List<TraversalRoomAnchor> roomAnchors = projectRoomAnchors(corridor.resolvedRooms(input));
        return new TraversalPlanRequest(
                corridor.corridorId(),
                corridor.mapId(),
                roomAnchors,
                corridor.resolvedWaypointCells(input),
                corridor.resolvedDoorBindings(input),
                buildObstacles(input.roomsById(), input.stairs(), corridor.corridorId()));
    }

    private static List<TraversalRoomAnchor> projectRoomAnchors(List<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalRoomAnchor> result = new ArrayList<>();
        for (Room room : rooms) {
            TraversalRoomAnchor roomAnchor = TraversalRoomAnchor.from(room);
            if (roomAnchor != null) {
                result.add(roomAnchor);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<CubePoint> buildObstacles(Map<Long, Room> roomsById, List<DungeonStair> stairs, Long corridorId) {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        if (roomsById != null && !roomsById.isEmpty()) {
            for (Room room : roomsById.values()) {
                if (room != null && room.roomId() != null) {
                    result.addAll(room.cubePoints());
                }
            }
        }
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair != null && !java.util.Objects.equals(stair.corridorId(), corridorId)) {
                result.addAll(stair.occupiedPositions());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
