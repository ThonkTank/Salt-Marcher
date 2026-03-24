package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
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

    public static CorridorPlan plan(Corridor corridor, CorridorPlanningInput input) {
        PlannerInstrumentation instrumentation = PlannerInstrumentation.create();
        long startedAt = instrumentation.startTimer();
        try {
            if (corridor == null || input == null) {
                return new CorridorPlan(CorridorPath.unroutable(new GridRoute(List.of())), List.of());
            }
            List<Room> rooms = corridor.resolvedRooms(input);
            List<Point2i> waypointCells2d = corridor.resolvedWaypointCells(input);
            List<CubePoint> waypointCells = resolveWaypointCells(waypointCells2d, rooms, input);
            Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
            GridRoute route = buildRoute(rooms, waypointCells2d);
            if (rooms.size() < 2) {
                return new CorridorPlan(CorridorPath.unroutable(route), List.of());
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
            CorridorPath path = toCorridorPath(route, tree, rooms, input.roomLevels());
            return new CorridorPlan(path, corridorConnections(corridor, tree));
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

    private static CorridorPath toCorridorPath(
            GridRoute route,
            SteinerTree tree,
            List<Room> rooms,
            Map<Long, Integer> roomLevels
    ) {
        if (tree == null || !tree.isRoutable()) {
            return CorridorPath.unroutable(route);
        }
        Set<CubePoint> corridorCells = filterCorridorCells(tree, rooms, roomLevels);
        boolean directlyAdjacent = corridorCells.isEmpty() && tree != null && !tree.openings().isEmpty();
        boolean routable = tree.connectedRoomIds().size() >= rooms.size()
                && (!corridorCells.isEmpty() || !tree.openings().isEmpty());
        return new CorridorPath(
                route,
                corridorCells,
                directlyAdjacent,
                routable);
    }

    private static Set<CubePoint> filterCorridorCells(
            SteinerTree tree,
            List<Room> rooms,
            Map<Long, Integer> roomLevels
    ) {
        Map<Integer, Set<Point2i>> occupiedRoomCellsByLevel = occupiedRoomCellsByLevel(rooms, roomLevels);
        return tree.corridorCells().stream()
                .filter(cell -> !occupiesRoomCell(cell, occupiedRoomCellsByLevel))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static List<CorridorConnection> corridorConnections(Corridor corridor, SteinerTree tree) {
        if (corridor == null || tree == null || tree.openings().isEmpty()) {
            return List.of();
        }
        List<CorridorConnection> result = new ArrayList<>();
        for (DoorEdge doorEdge : tree.openings()) {
            if (doorEdge == null || doorEdge.edge() == null) {
                continue;
            }
            result.add(new CorridorConnection(
                    corridor.corridorId(),
                    corridor.mapId(),
                    new Door(Set.of(doorEdge.edge()), Door.TraversalState.CLOSED),
                    List.of(
                            ConnectionEndpoint.room(doorEdge.roomId()),
                            ConnectionEndpoint.corridor(corridor.corridorId())),
                    doorEdge.levelZ()));
        }
        return List.copyOf(result);
    }

    private static Map<Integer, Set<Point2i>> occupiedRoomCellsByLevel(List<Room> rooms, Map<Long, Integer> roomLevels) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        if (rooms == null || rooms.isEmpty()) {
            return Map.of();
        }
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            int level = roomLevels == null ? 0 : roomLevels.getOrDefault(room.roomId(), 0);
            result.computeIfAbsent(level, ignored -> new LinkedHashSet<>())
                    .addAll(room.cells());
        }
        return Map.copyOf(result);
    }

    private static boolean occupiesRoomCell(CubePoint cell, Map<Integer, Set<Point2i>> occupiedRoomCellsByLevel) {
        if (cell == null || occupiedRoomCellsByLevel == null || occupiedRoomCellsByLevel.isEmpty()) {
            return false;
        }
        Set<Point2i> occupiedCells = occupiedRoomCellsByLevel.get(cell.z());
        return occupiedCells != null && occupiedCells.contains(cell.projectedCell());
    }
}
