package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class CorridorPlanningEngine {

    private CorridorPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static CorridorPlan plan(Corridor corridor, CorridorPlanningInput input) {
        if (corridor == null || input == null) {
            return new CorridorPlan(CorridorPath.unroutable(features.world.dungeonmap.model.geometry.GridRoute.empty()), List.of(), List.of());
        }
        List<Room> rooms = corridor.resolvedRooms(input);
        List<CubePoint> waypointCells = corridor.resolvedWaypointCells(input);
        Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
        return ResolvedCorridorPlanner.planResolved(
                corridor.corridorId(),
                corridor.mapId(),
                rooms,
                indexAnchorCells(rooms),
                waypointCells,
                doorBindings,
                buildObstacles(input.roomsById(), input.stairs(), corridor.corridorId()));
    }

    private static Set<CubePoint> buildObstacles(Map<Long, Room> roomsById, List<DungeonStair> stairs, Long corridorId) {
        Set<CubePoint> result = new LinkedHashSet<>();
        if (roomsById != null && !roomsById.isEmpty()) {
            for (Room room : roomsById.values()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                result.addAll(room.cubePoints());
            }
        }
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair != null && !java.util.Objects.equals(stair.corridorId(), corridorId)) {
                result.addAll(stair.occupiedPositions());
            }
        }
        if (result.isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(result);
    }

    private static Map<Long, Point2i> indexAnchorCells(List<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return Map.of();
        }
        Map<Long, Point2i> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            if (room.floor() != null) {
                result.put(room.roomId(), room.floor().shape().centerCell());
            }
        }
        return Map.copyOf(result);
    }
}
