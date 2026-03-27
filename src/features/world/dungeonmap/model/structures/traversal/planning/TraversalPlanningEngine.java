package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.planning.CorridorPlan;
import features.world.dungeonmap.model.structures.corridor.planning.ResolvedCorridorPlanner;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalPlanningEngine {

    private TraversalPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static TraversalPlan plan(TraversalPlanRequest request) {
        if (request == null) {
            return TraversalPlan.empty();
        }
        List<Room> rooms = materializeRooms(request.roomAnchors(), request.mapId());
        Map<Long, Point2i> anchorCellsByRoomId = indexAnchorCells(request.roomAnchors());
        CorridorPlan corridorPlan = ResolvedCorridorPlanner.planResolved(
                request.corridorId(),
                request.mapId(),
                rooms,
                anchorCellsByRoomId,
                request.waypointCells(),
                request.doorBindings(),
                request.obstacles());
        CorridorTraversalSlice slice = new CorridorTraversalSlice(
                request.corridorId(),
                corridorPlan.path(),
                corridorPlan.connections());
        return new TraversalPlan(List.of(slice), corridorPlan.stairPlacements());
    }

    private static List<Room> materializeRooms(List<TraversalRoomAnchor> roomAnchors, long mapId) {
        if (roomAnchors == null || roomAnchors.isEmpty()) {
            return List.of();
        }
        ArrayList<Room> result = new ArrayList<>();
        for (TraversalRoomAnchor roomAnchor : roomAnchors) {
            if (roomAnchor == null) {
                continue;
            }
            result.add(Room.create(
                    roomAnchor.roomId(),
                    mapId,
                    roomAnchor.clusterId() == null ? 0L : roomAnchor.clusterId(),
                    "Raum " + (roomAnchor.roomId() == null ? "neu" : roomAnchor.roomId()),
                    floorsByLevel(roomAnchor)));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Map<Long, Point2i> indexAnchorCells(List<TraversalRoomAnchor> roomAnchors) {
        if (roomAnchors == null || roomAnchors.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<Long, Point2i> result = new LinkedHashMap<>();
        for (TraversalRoomAnchor roomAnchor : roomAnchors) {
            if (roomAnchor != null && roomAnchor.roomId() != null) {
                result.put(roomAnchor.roomId(), roomAnchor.anchorCell());
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Floor> floorsByLevel(TraversalRoomAnchor roomAnchor) {
        LinkedHashMap<Integer, Set<Point2i>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint occupiedCell : roomAnchor.occupiedCells()) {
            cellsByLevel.computeIfAbsent(occupiedCell.z(), ignored -> new LinkedHashSet<>())
                    .add(occupiedCell.projectedCell());
        }
        LinkedHashMap<Integer, Floor> result = new LinkedHashMap<>();
        Set<Integer> levels = roomAnchor.levels().isEmpty()
                ? Set.of(roomAnchor.primaryLevel())
                : roomAnchor.levels();
        for (Integer level : levels) {
            if (level == null) {
                continue;
            }
            Set<Point2i> cells = cellsByLevel.get(level);
            Floor floor = cells == null || cells.isEmpty()
                    ? new Floor(null)
                    : new Floor(TileShape.fromAbsoluteCells(roomAnchor.anchorCell(), cells));
            result.put(level, floor);
        }
        return result.isEmpty() ? Map.of(roomAnchor.primaryLevel(), new Floor(null)) : Map.copyOf(result);
    }
}
