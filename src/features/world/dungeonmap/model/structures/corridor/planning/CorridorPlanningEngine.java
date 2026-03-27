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
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;

public final class CorridorPlanningEngine {

    private static final Logger LOGGER = Logger.getLogger(CorridorPlanningEngine.class.getName());
    private static final boolean STAIR_DEBUG = true; // TODO: gate behind system property once stair planning is stable

    private CorridorPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static CorridorPlan plan(Corridor corridor, CorridorPlanningInput input) {
        PlannerInstrumentation instrumentation = PlannerInstrumentation.create();
        long startedAt = instrumentation.startTimer();
        try {
            if (corridor == null || input == null) {
                return new CorridorPlan(CorridorPath.unroutable(new GridRoute(List.of())), List.of(), List.of());
            }
            List<Room> rooms = corridor.resolvedRooms(input);
            List<CubePoint> waypointCells = corridor.resolvedWaypointCells(input);
            Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
            GridRoute route = buildRoute(rooms, waypointCells);
            if (rooms.size() < 2) {
                return new CorridorPlan(CorridorPath.unroutable(route), List.of(), List.of());
            }

            Set<CubePoint> allObstacles = buildObstacles(input.roomsById(), input.stairs(), corridor.corridorId());
            PlannerContext context = new PlannerContext(
                    rooms,
                    allObstacles,
                    waypointCells,
                    doorBindings,
                    instrumentation);
            SteinerTree tree = SteinerTreeBuilder.bestTree(context);
            CorridorPath path = toCorridorPath(route, tree, rooms);
            CorridorPlan plan = new CorridorPlan(path, corridorConnections(corridor, tree), tree == null ? List.of() : tree.stairPlacements());
            logStairPlan(rooms, tree, path, plan);
            return plan;
        } finally {
            instrumentation.logSummary(startedAt);
        }
    }

    private static GridRoute buildRoute(List<Room> rooms, List<CubePoint> waypointCells) {
        List<GridAnchor> anchors = new ArrayList<>();
        for (CubePoint waypoint : waypointCells) {
            if (waypoint != null) {
                anchors.add(GridAnchor.atTile(waypoint.projectedCell()));
            }
        }
        if (anchors.isEmpty()) {
            for (Room room : rooms) {
                anchors.add(GridAnchor.atTile(room.floor().shape().centerCell()));
            }
        }
        return new GridRoute(anchors);
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

    private static CorridorPath toCorridorPath(
            GridRoute route,
            SteinerTree tree,
            List<Room> rooms
    ) {
        if (tree == null || !tree.isRoutable()) {
            return CorridorPath.unroutable(route);
        }
        Set<CubePoint> corridorCells = filterCorridorCells(tree, rooms);
        boolean directlyAdjacent = corridorCells.isEmpty() && tree != null && !tree.openings().isEmpty();
        boolean routable = tree.connectedRoomIds().size() >= rooms.size()
                && (!corridorCells.isEmpty() || !tree.openings().isEmpty());
        return new CorridorPath(
                route,
                corridorCells,
                directlyAdjacent,
                routable);
    }

    private static Set<CubePoint> filterCorridorCells(SteinerTree tree, List<Room> rooms) {
        Map<Integer, Set<Point2i>> occupiedRoomCellsByLevel = occupiedRoomCellsByLevel(rooms);
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

    private static Map<Integer, Set<Point2i>> occupiedRoomCellsByLevel(List<Room> rooms) {
        Map<Integer, Set<Point2i>> result = new LinkedHashMap<>();
        if (rooms == null || rooms.isEmpty()) {
            return Map.of();
        }
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (CubePoint cell : room.cubePoints()) {
                result.computeIfAbsent(cell.z(), ignored -> new LinkedHashSet<>())
                        .add(cell.projectedCell());
            }
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

    private static void logStairPlan(List<Room> rooms, SteinerTree tree, CorridorPath path, CorridorPlan plan) {
        if (!STAIR_DEBUG || plan.stairPlacements().isEmpty()) {
            return;
        }
        String caller = Thread.currentThread().getStackTrace().length > 4
                ? Thread.currentThread().getStackTrace()[3].getMethodName() : "unknown";
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== CORRIDOR STAIR PLAN (caller=").append(caller).append(") ===\n");
        for (Room room : rooms) {
            sb.append("Room ").append(room.roomId()).append(" '").append(room.name())
                    .append("' levels=").append(room.levels())
                    .append(" cells=").append(room.cubePoints()).append("\n");
        }
        sb.append("Corridor cells (").append(path.cells().size()).append("): ").append(path.cells()).append("\n");
        sb.append("Openings: ").append(tree == null ? "null" : tree.openings()).append("\n");
        sb.append("Connections: ").append(plan.connections().size()).append("\n");
        for (StairPlacement stair : plan.stairPlacements()) {
            sb.append("StairPlacement: anchor=").append(stair.anchor())
                    .append(" shape=").append(stair.shape())
                    .append(" dir=").append(stair.direction())
                    .append(" exits=").append(stair.exitLevels())
                    .append(" footprint=").append(stair.footprint()).append("\n");
            for (CubePoint fp : stair.footprint()) {
                boolean inCorridor = path.cells().contains(fp);
                boolean adjCorridor = path.cells().stream().anyMatch(cc ->
                        Math.abs(fp.x() - cc.x()) + Math.abs(fp.y() - cc.y()) + Math.abs(fp.z() - cc.z()) == 1);
                boolean adjRoom = rooms.stream().anyMatch(room -> room.cubePoints().stream().anyMatch(rc ->
                        Math.abs(fp.x() - rc.x()) + Math.abs(fp.y() - rc.y()) + Math.abs(fp.z() - rc.z()) == 1));
                boolean insideRoom = rooms.stream().anyMatch(room -> room.cubePoints().contains(fp));
                sb.append("  ").append(fp)
                        .append(" inCorridor=").append(inCorridor)
                        .append(" adjCorridor=").append(adjCorridor)
                        .append(" adjRoom=").append(adjRoom)
                        .append(" insideRoom=").append(insideRoom).append("\n");
            }
        }
        sb.append("=== END ===");
        LOGGER.info(sb.toString());
    }
}
