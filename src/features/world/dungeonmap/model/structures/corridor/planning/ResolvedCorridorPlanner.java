package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;

public final class ResolvedCorridorPlanner {

    private static final Logger LOGGER = Logger.getLogger(ResolvedCorridorPlanner.class.getName());
    private static final boolean STAIR_DEBUG = true; // TODO: gate behind system property once stair planning is stable

    private ResolvedCorridorPlanner() {
        throw new AssertionError("No instances");
    }

    public static CorridorPlan planResolved(
            Long corridorId,
            long mapId,
            List<Room> rooms,
            Map<Long, Point2i> anchorCellsByRoomId,
            List<CubePoint> waypointCells,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings,
            Set<CubePoint> obstacles
    ) {
        PlannerInstrumentation instrumentation = PlannerInstrumentation.create();
        long startedAt = instrumentation.startTimer();
        try {
            List<Room> targetRooms = rooms == null ? List.of() : List.copyOf(rooms);
            GridRoute route = buildRoute(targetRooms, anchorCellsByRoomId, waypointCells);
            if (targetRooms.size() < 2) {
                return new CorridorPlan(CorridorPath.unroutable(route), List.of(), List.of());
            }
            PlannerContext context = new PlannerContext(
                    targetRooms,
                    obstacles,
                    waypointCells,
                    doorBindings,
                    instrumentation);
            SteinerTree tree = SteinerTreeBuilder.bestTree(context);
            CorridorPath path = toCorridorPath(route, tree, targetRooms);
            CorridorPlan plan = new CorridorPlan(
                    path,
                    corridorConnections(corridorId, mapId, tree),
                    tree == null ? List.of() : tree.stairPlacements());
            logStairPlan(targetRooms, tree, path, plan);
            return plan;
        } finally {
            instrumentation.logSummary(startedAt);
        }
    }

    private static GridRoute buildRoute(
            List<Room> rooms,
            Map<Long, Point2i> anchorCellsByRoomId,
            List<CubePoint> waypointCells
    ) {
        List<GridAnchor> anchors = new ArrayList<>();
        for (CubePoint waypoint : waypointCells == null ? List.<CubePoint>of() : waypointCells) {
            if (waypoint != null) {
                anchors.add(GridAnchor.atTile(waypoint.projectedCell()));
            }
        }
        if (anchors.isEmpty()) {
            for (Room room : rooms == null ? List.<Room>of() : rooms) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Point2i anchorCell = anchorCellsByRoomId == null ? null : anchorCellsByRoomId.get(room.roomId());
                if (anchorCell == null && room.floor() != null) {
                    anchorCell = room.floor().shape().centerCell();
                }
                if (anchorCell != null) {
                    anchors.add(GridAnchor.atTile(anchorCell));
                }
            }
        }
        return new GridRoute(anchors);
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
        boolean directlyAdjacent = corridorCells.isEmpty() && !tree.openings().isEmpty();
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

    private static List<CorridorConnection> corridorConnections(Long corridorId, long mapId, SteinerTree tree) {
        if (tree == null || tree.openings().isEmpty()) {
            return List.of();
        }
        List<CorridorConnection> result = new ArrayList<>();
        for (DoorEdge doorEdge : tree.openings()) {
            if (doorEdge == null || doorEdge.edge() == null) {
                continue;
            }
            result.add(new CorridorConnection(
                    corridorId,
                    mapId,
                    new Door(Set.of(doorEdge.edge()), Door.TraversalState.CLOSED),
                    List.of(
                            ConnectionEndpoint.room(doorEdge.roomId()),
                            ConnectionEndpoint.corridor(corridorId)),
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
        StringBuilder sb = new StringBuilder();
        sb.append("\n=== CORRIDOR STAIR PLAN ===\n");
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
            for (CubePoint footprintCell : stair.footprint()) {
                boolean inCorridor = path.cells().contains(footprintCell);
                boolean adjCorridor = path.cells().stream().anyMatch(corridorCell ->
                        Math.abs(footprintCell.x() - corridorCell.x()) + Math.abs(footprintCell.y() - corridorCell.y()) + Math.abs(footprintCell.z() - corridorCell.z()) == 1);
                boolean adjRoom = rooms.stream().anyMatch(room -> room.cubePoints().stream().anyMatch(roomCell ->
                        Math.abs(footprintCell.x() - roomCell.x()) + Math.abs(footprintCell.y() - roomCell.y()) + Math.abs(footprintCell.z() - roomCell.z()) == 1));
                boolean insideRoom = rooms.stream().anyMatch(room -> room.cubePoints().contains(footprintCell));
                sb.append("  ").append(footprintCell)
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
