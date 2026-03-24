package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public final class CorridorPlanningEngine {

    private CorridorPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static CorridorPath plan(Corridor corridor, CorridorPlanningInput input) {
        PlannerInstrumentation instrumentation = PlannerInstrumentation.create();
        long startedAt = instrumentation.startTimer();
        try {
            if (corridor == null || input == null) {
                return CorridorPath.unroutable(new GridRoute(List.of()));
            }
            List<Room> rooms = corridor.resolvedRooms(input);
            List<Point2i> waypointCells2d = corridor.resolvedWaypointCells(input);
            List<CubePoint> waypointCells = resolveWaypointCells(waypointCells2d, rooms, input);
            Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
            GridRoute route = buildRoute(rooms, waypointCells2d);
            if (rooms.size() < 2) {
                return CorridorPath.unroutable(route);
            }

            Set<CubePoint> allObstacles = buildObstacles(input.roomsById(), input.roomLevels());
            PlannerContext context = new PlannerContext(
                    rooms,
                    input.roomLevels(),
                    allObstacles,
                    waypointCells,
                    doorBindings,
                    instrumentation);
            SteinerTree tree = SteinerTreeBuilder.bestTree(context);
            return toCorridorPath(route, tree, rooms);
        } finally {
            instrumentation.logSummary(startedAt);
        }
    }

    private static GridRoute buildRoute(List<Room> rooms, List<Point2i> waypointCells) {
        List<GridAnchor> anchors = new ArrayList<>();
        for (Point2i waypoint : waypointCells) {
            if (waypoint != null) {
                anchors.add(GridAnchor.atTile(waypoint));
            }
        }
        if (anchors.isEmpty()) {
            for (Room room : rooms) {
                anchors.add(GridAnchor.atTile(room.floor().shape().centerCell()));
            }
        }
        return new GridRoute(anchors);
    }

    private static Set<CubePoint> buildObstacles(Map<Long, Room> roomsById, Map<Long, Integer> roomLevels) {
        Set<CubePoint> result = new LinkedHashSet<>();
        if (roomsById == null || roomsById.isEmpty()) {
            return Set.of();
        }
        for (Room room : roomsById.values()) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            int levelZ = roomLevels == null ? 0 : roomLevels.getOrDefault(room.roomId(), 0);
            for (Point2i cell : room.cells()) {
                result.add(CubePoint.at(cell, levelZ));
            }
        }
        return Set.copyOf(result);
    }

    private static List<CubePoint> resolveWaypointCells(
            List<Point2i> waypointCells,
            List<Room> rooms,
            CorridorPlanningInput input
    ) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return List.of();
        }
        List<CubePoint> result = new ArrayList<>();
        for (Point2i waypoint : waypointCells) {
            if (waypoint == null) {
                continue;
            }
            result.add(CubePoint.at(waypoint, nearestRoomLevel(waypoint, rooms, input)));
        }
        return List.copyOf(result);
    }

    private static int nearestRoomLevel(Point2i waypoint, List<Room> rooms, CorridorPlanningInput input) {
        Room nearest = null;
        int bestDistance = Integer.MAX_VALUE;
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null || room.roomId() == null || room.floor() == null || room.floor().shape() == null) {
                continue;
            }
            int distance = room.floor().shape().centerCell().distanceTo(waypoint);
            if (distance < bestDistance) {
                bestDistance = distance;
                nearest = room;
            }
        }
        return nearest == null ? 0 : input.roomLevel(nearest.roomId());
    }

    private static CorridorPath toCorridorPath(GridRoute route, SteinerTree tree, List<Room> rooms) {
        if (tree == null || !tree.isRoutable()) {
            return CorridorPath.unroutable(route);
        }
        Set<Point2i> projectedCells = tree.corridorCells().stream()
                .map(CubePoint::projectedCell)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Integer, Floor> floorsByLevel = new LinkedHashMap<>();
        for (Integer level : tree.levels()) {
            Set<Point2i> levelCells = tree.cellsAtLevel(level);
            floorsByLevel.put(level, new Floor(TileShape.fromAbsoluteCells(levelCells)));
        }
        Set<VertexEdge> doorEdges = tree.doorEdges().stream()
                .map(DoorEdge::edge)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Integer, Set<VertexEdge>> mutableDoorEdgesByLevel = new LinkedHashMap<>();
        for (DoorEdge doorEdge : tree.doorEdges()) {
            if (doorEdge != null && doorEdge.edge() != null) {
                mutableDoorEdgesByLevel
                        .computeIfAbsent(doorEdge.levelZ(), ignored -> new LinkedHashSet<>())
                        .add(doorEdge.edge());
            }
        }
        Map<Integer, Set<VertexEdge>> doorEdgesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<VertexEdge>> entry : mutableDoorEdgesByLevel.entrySet()) {
            doorEdgesByLevel.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        boolean directlyAdjacent = tree.corridorCells().isEmpty() && !doorEdges.isEmpty();
        boolean routable = tree.connectedRoomIds().size() >= rooms.size()
                && (!projectedCells.isEmpty() || !doorEdges.isEmpty());
        return new CorridorPath(
                route,
                new Floor(TileShape.fromAbsoluteCells(projectedCells)),
                Map.copyOf(floorsByLevel),
                Set.copyOf(doorEdges),
                doorEdgesByLevel,
                directlyAdjacent,
                routable);
    }
}
