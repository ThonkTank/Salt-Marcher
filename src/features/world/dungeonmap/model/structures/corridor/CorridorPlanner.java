package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

final class CorridorPlanner {

    private static final int PATHFINDING_GRID_PADDING = 6;

    private CorridorPlanner() {
        throw new AssertionError("No instances");
    }

    static CorridorPath plan(Corridor corridor, CorridorPlanningInput input) {
        GridRoute route = resolvedRoute(corridor, input);
        if (corridor == null || input == null) {
            return CorridorPath.empty(route);
        }
        List<Room> rooms = corridor.resolvedRooms(input);
        if (rooms.size() < 2) {
            return CorridorPath.empty(route);
        }

        Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
        List<Point2i> waypointCells = corridor.resolvedWaypointCells(input);
        PlannerContext context = new PlannerContext(rooms, waypointCells, doorBindings);
        MutableNetwork network = bestNetwork(context);

        boolean routable = network.connectedRoomIds.size() == rooms.size()
                && (!network.corridorCells.isEmpty() || !network.doors.isEmpty());
        return new CorridorPath(
                route,
                new Floor(TileShape.fromAbsoluteCells(network.corridorCells)),
                List.copyOf(network.doors.values()),
                network.directlyAdjacentOnly,
                routable);
    }

    private static MutableNetwork bestNetwork(PlannerContext context) {
        MutableNetwork best = null;
        NetworkScore bestScore = null;
        for (Room seedRoom : context.rooms()) {
            if (seedRoom == null || seedRoom.roomId() == null) {
                continue;
            }
            MutableNetwork candidate = buildNetwork(seedRoom, context);
            NetworkScore candidateScore = candidate.score(context.rooms());
            if (bestScore == null || candidateScore.compareTo(bestScore) < 0) {
                best = candidate;
                bestScore = candidateScore;
            }
        }
        return best == null ? new MutableNetwork() : best;
    }

    private static MutableNetwork buildNetwork(Room seedRoom, PlannerContext context) {
        MutableNetwork network = new MutableNetwork();
        network.connectedRoomIds.add(seedRoom.roomId());
        if (!context.waypointCells().isEmpty()) {
            ConnectionPlan seedPlan = bestSeedWaypointPlan(seedRoom, context);
            if (seedPlan != null) {
                network.apply(seedPlan);
            }
        }
        while (network.connectedRoomIds.size() < context.rooms().size()) {
            ConnectionPlan next = bestNextPlan(context, network);
            if (next == null) {
                break;
            }
            network.apply(next);
        }
        return network;
    }

    private static GridRoute resolvedRoute(Corridor corridor, CorridorPlanningInput input) {
        if (corridor == null || input == null) {
            return GridRoute.empty();
        }
        List<GridAnchor> anchors = new ArrayList<>();
        List<Room> rooms = corridor.resolvedRooms(input);
        List<Point2i> waypointCells = corridor.resolvedWaypointCells(input);
        if (!waypointCells.isEmpty()) {
            if (!rooms.isEmpty()) {
                anchors.add(GridAnchor.atTile(rooms.getFirst().floor().shape().centerCell()));
            }
            for (Point2i waypointCell : waypointCells) {
                anchors.add(GridAnchor.atTile(waypointCell));
            }
            if (rooms.size() > 1) {
                anchors.add(GridAnchor.atTile(rooms.getLast().floor().shape().centerCell()));
            }
        } else {
            for (Room room : rooms) {
                anchors.add(GridAnchor.atTile(room.floor().shape().centerCell()));
            }
        }
        return new GridRoute(anchors);
    }

    private static ConnectionPlan bestSeedWaypointPlan(Room seedRoom, PlannerContext context) {
        ConnectionPlan best = null;
        for (ExitCandidate exit : context.exitCandidates(seedRoom)) {
            List<Point2i> path = pathThroughPoints(exit.outsideCell, context.waypointCells(), context.occupancy());
            if (path.isEmpty()) {
                continue;
            }
            best = better(best, new ConnectionPlan(seedRoom.roomId(), path, List.of(exit.door), false));
        }
        return best;
    }

    private static ConnectionPlan bestPlanForRoom(Room room, PlannerContext context, MutableNetwork network) {
        ConnectionPlan best = null;
        if (!network.corridorCells.isEmpty()) {
            best = better(best, bestPlanToNetwork(room, network.corridorCells, context));
        }
        for (Room connectedRoom : context.rooms()) {
            if (connectedRoom == null || !network.connectedRoomIds.contains(connectedRoom.roomId())) {
                continue;
            }
            best = better(best, bestPlanToConnectedRoom(room, connectedRoom, context));
        }
        return best;
    }

    private static ConnectionPlan bestNextPlan(PlannerContext context, MutableNetwork network) {
        ConnectionPlan best = null;
        NetworkScore bestScore = null;
        for (Room room : context.rooms()) {
            if (room == null || room.roomId() == null || network.connectedRoomIds.contains(room.roomId())) {
                continue;
            }
            for (ConnectionPlan candidate : connectionPlansForRoom(room, context, network)) {
                NetworkScore candidateScore = network.scoreWith(context.rooms(), candidate);
                if (bestScore == null
                        || candidateScore.compareTo(bestScore) < 0
                        || (candidateScore.compareTo(bestScore) == 0 && candidate.score().compareTo(best.score()) < 0)) {
                    best = candidate;
                    bestScore = candidateScore;
                }
            }
        }
        return best;
    }

    private static List<ConnectionPlan> connectionPlansForRoom(Room room, PlannerContext context, MutableNetwork network) {
        List<ConnectionPlan> result = new ArrayList<>();
        if (network.corridorCells.isEmpty()) {
            for (Room connectedRoom : context.rooms()) {
                if (connectedRoom == null || !network.connectedRoomIds.contains(connectedRoom.roomId())) {
                    continue;
                }
                ConnectionPlan candidate = bestPlanToConnectedRoom(room, connectedRoom, context);
                if (candidate != null) {
                    result.add(candidate);
                }
            }
        } else {
            ConnectionPlan joinNetwork = bestPlanToNetwork(room, network.corridorCells, context);
            if (joinNetwork != null) {
                result.add(joinNetwork);
            }
            for (Room connectedRoom : context.rooms()) {
                if (connectedRoom == null || !network.connectedRoomIds.contains(connectedRoom.roomId())) {
                    continue;
                }
                ConnectionPlan candidate = bestFreshPathPlan(room, connectedRoom, context);
                if (candidate != null) {
                    result.add(candidate);
                }
            }
        }
        return List.copyOf(result);
    }

    private static ConnectionPlan bestFreshPathPlan(Room room, Room connectedRoom, PlannerContext context) {
        if (room == null || connectedRoom == null) {
            return null;
        }
        ConnectionPlan best = null;
        List<ExitCandidate> roomExits = context.exitCandidates(room);
        List<ExitCandidate> connectedExits = context.exitCandidates(connectedRoom);
        for (ExitCandidate exit : roomExits) {
            for (ExitCandidate target : connectedExits) {
                List<Point2i> targets = context.waypointCells().isEmpty()
                        ? List.of(target.outsideCell)
                        : append(context.waypointCells(), target.outsideCell);
                List<Point2i> path = pathThroughPoints(exit.outsideCell, targets, context.occupancy());
                if (path.isEmpty() && !exit.outsideCell.equals(target.outsideCell)) {
                    continue;
                }
                best = better(best, new ConnectionPlan(
                        room.roomId(),
                        path,
                        List.of(exit.door, target.door),
                        path.isEmpty()));
            }
        }
        return best;
    }

    private static ConnectionPlan bestPlanToNetwork(Room room, Set<Point2i> networkCells, PlannerContext context) {
        ConnectionPlan best = null;
        for (ExitCandidate exit : context.exitCandidates(room)) {
            List<Point2i> path = shortestPathToAny(exit.outsideCell, networkCells, context.occupancy());
            if (path == null) {
                continue;
            }
            best = better(best, new ConnectionPlan(room.roomId(), path, List.of(exit.door), path.isEmpty()));
        }
        return best;
    }

    private static ConnectionPlan bestPlanToConnectedRoom(Room room, Room connectedRoom, PlannerContext context) {
        if (room == null || connectedRoom == null || Objects.equals(room.roomId(), connectedRoom.roomId())) {
            return null;
        }
        ConnectionPlan best = directAdjacencyPlan(room, connectedRoom, context.doorBindings());
        List<ExitCandidate> roomExits = context.exitCandidates(room);
        List<ExitCandidate> connectedExits = context.exitCandidates(connectedRoom);
        for (ExitCandidate exit : roomExits) {
            for (ExitCandidate target : connectedExits) {
                List<Point2i> path = shortestPath(exit.outsideCell, target.outsideCell, context.occupancy());
                if (path == null) {
                    continue;
                }
                best = better(best, new ConnectionPlan(
                        room.roomId(),
                        path,
                        List.of(exit.door, target.door),
                        path.isEmpty()));
            }
        }
        return best;
    }

    private static ConnectionPlan directAdjacencyPlan(
            Room room,
            Room connectedRoom,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings
    ) {
        Set<Point2i> roomCells = room.cells();
        Set<Point2i> connectedCells = connectedRoom.cells();
        ResolvedCorridorDoorBinding roomBinding = doorBindings.get(room.roomId());
        ResolvedCorridorDoorBinding connectedBinding = doorBindings.get(connectedRoom.roomId());
        for (Point2i cell : roomCells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i otherCell = cell.add(step);
                if (!connectedCells.contains(otherCell)) {
                    continue;
                }
                if (roomBinding != null && (!roomBinding.absoluteCell().equals(cell) || !roomBinding.direction().equals(step))) {
                    continue;
                }
                Point2i reverse = new Point2i(-step.x(), -step.y());
                if (connectedBinding != null
                        && (!connectedBinding.absoluteCell().equals(otherCell) || !connectedBinding.direction().equals(reverse))) {
                    continue;
                }
                Door door = new Door(Set.of(VertexEdge.betweenCellAndStep(cell, step)));
                return new ConnectionPlan(room.roomId(), List.of(), List.of(door), true);
            }
        }
        return null;
    }

    private static List<ExitCandidate> exitCandidates(
            Room room,
            Map<Point2i, Long> occupancy,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings
    ) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        Set<Point2i> roomCells = room.cells();
        ResolvedCorridorDoorBinding binding = doorBindings.get(room.roomId());
        List<ExitCandidate> result = new ArrayList<>();
        for (Point2i cell : roomCells) {
            for (Point2i direction : Point2i.CARDINAL_STEPS) {
                Point2i outsideCell = cell.add(direction);
                if (roomCells.contains(outsideCell)) {
                    continue;
                }
                if (occupancy.containsKey(outsideCell)) {
                    continue;
                }
                if (binding != null
                        && (!binding.absoluteCell().equals(cell) || !binding.direction().equals(direction))) {
                    continue;
                }
                result.add(new ExitCandidate(
                        cell,
                        outsideCell,
                        direction,
                        new Door(Set.of(VertexEdge.betweenCellAndStep(cell, direction)))));
            }
        }
        result.sort(Comparator
                .comparingInt((ExitCandidate candidate) -> candidate.outsideCell.x())
                .thenComparingInt(candidate -> candidate.outsideCell.y())
                .thenComparingInt(candidate -> candidate.direction.x())
                .thenComparingInt(candidate -> candidate.direction.y()));
        return List.copyOf(result);
    }

    private static ConnectionPlan better(ConnectionPlan current, ConnectionPlan candidate) {
        if (candidate == null) {
            return current;
        }
        if (current == null) {
            return candidate;
        }
        return candidate.score().compareTo(current.score()) < 0 ? candidate : current;
    }

    private static Map<Point2i, Long> roomOccupancy(List<Room> rooms) {
        Map<Point2i, Long> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (Point2i cell : room.cells()) {
                result.put(cell, room.roomId());
            }
        }
        return Map.copyOf(result);
    }

    private static List<Point2i> pathThroughPoints(Point2i start, List<Point2i> targets, Map<Point2i, Long> roomOccupancy) {
        if (start == null || targets == null || targets.isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        Point2i current = start;
        for (Point2i target : targets) {
            if (target == null) {
                continue;
            }
            List<Point2i> leg = shortestPath(current, target, roomOccupancy);
            if (leg == null) {
                return List.of();
            }
            if (result.isEmpty()) {
                result.addAll(leg);
            } else if (!leg.isEmpty()) {
                result.addAll(leg.subList(1, leg.size()));
            }
            current = target;
        }
        return List.copyOf(result);
    }

    private static List<Point2i> shortestPathToAny(Point2i start, Set<Point2i> goals, Map<Point2i, Long> roomOccupancy) {
        return shortestPath(start, goals, roomOccupancy);
    }

    private static List<Point2i> shortestPath(Point2i start, Point2i goal, Map<Point2i, Long> roomOccupancy) {
        if (goal == null) {
            return null;
        }
        return shortestPath(start, Set.of(goal), roomOccupancy);
    }

    private static List<Point2i> shortestPath(Point2i start, Set<Point2i> goals, Map<Point2i, Long> roomOccupancy) {
        if (start == null || goals == null || goals.isEmpty()) {
            return null;
        }
        List<Point2i> goalList = goals.stream()
                .filter(Objects::nonNull)
                .filter(goal -> !roomOccupancy.containsKey(goal) || start.equals(goal))
                .toList();
        if (goalList.isEmpty()) {
            return null;
        }
        if (goalList.contains(start)) {
            return List.of();
        }
        if (roomOccupancy.containsKey(start)) {
            return null;
        }
        PathGrid grid = buildPathfindingGrid(roomOccupancy.keySet(), start, goalList, PATHFINDING_GRID_PADDING);
        record QueueNode(PathStep step, int corners) {}
        PriorityQueue<QueueNode> open = new PriorityQueue<>(Comparator
                .comparingInt(QueueNode::corners)
                .thenComparingInt(node -> node.step.distance())
                .thenComparingInt(node -> distanceToClosestGoal(node.step.point(), goalList)));
        Map<PathStep, Integer> bestCornersByStep = new HashMap<>();
        Map<PathStep, PathStep> previous = new HashMap<>();
        PathStep startStep = new PathStep(start, -1, 0);
        open.add(new QueueNode(startStep, 0));
        bestCornersByStep.put(startStep, 0);

        int maxAllowedDistance = Integer.MAX_VALUE;
        PathStep bestGoalStep = null;
        PathScore bestGoalScore = null;
        while (!open.isEmpty()) {
            QueueNode node = open.poll();
            Integer currentCorners = bestCornersByStep.get(node.step());
            if (currentCorners == null || currentCorners != node.corners()) {
                continue;
            }
            PathScore currentScore = new PathScore(node.step.distance(), node.corners());
            if (goalList.contains(node.step.point())) {
                if (bestGoalStep == null) {
                    int shortestPossibleDistance = node.step.distance();
                    maxAllowedDistance = shortestPossibleDistance + toleratedExtraDistance(shortestPossibleDistance);
                }
                if (bestGoalScore == null || currentScore.compareTo(bestGoalScore) < 0) {
                    bestGoalStep = node.step();
                    bestGoalScore = currentScore;
                }
                continue;
            }
            for (int directionIndex = 0; directionIndex < Point2i.CARDINAL_STEPS.size(); directionIndex++) {
                Point2i next = node.step.point().add(Point2i.CARDINAL_STEPS.get(directionIndex));
                boolean nextIsGoal = goalList.contains(next);
                if (!grid.isPassable(next) && !nextIsGoal) {
                    continue;
                }
                int nextDistance = node.step.distance() + 1;
                if (nextDistance > maxAllowedDistance
                        || nextDistance + distanceToClosestGoal(next, goalList) > maxAllowedDistance) {
                    continue;
                }
                int nextCorners = node.step.directionIndex() < 0 || node.step.directionIndex() == directionIndex
                        ? node.corners()
                        : node.corners() + 1;
                PathStep nextStep = new PathStep(next, directionIndex, nextDistance);
                Integer bestKnownCorners = bestCornersByStep.get(nextStep);
                if (bestKnownCorners != null && bestKnownCorners <= nextCorners) {
                    continue;
                }
                bestCornersByStep.put(nextStep, nextCorners);
                previous.put(nextStep, node.step());
                open.add(new QueueNode(nextStep, nextCorners));
            }
        }
        return bestGoalStep == null ? null : reconstructPath(previous, bestGoalStep);
    }

    private static PathGrid buildPathfindingGrid(Set<Point2i> blocked, Point2i start, Iterable<Point2i> goals, int padding) {
        int minX = start.x() - padding;
        int maxX = start.x() + padding;
        int minY = start.y() - padding;
        int maxY = start.y() + padding;
        for (Point2i goal : goals) {
            minX = Math.min(minX, goal.x() - padding);
            maxX = Math.max(maxX, goal.x() + padding);
            minY = Math.min(minY, goal.y() - padding);
            maxY = Math.max(maxY, goal.y() + padding);
        }
        for (Point2i point : blocked) {
            minX = Math.min(minX, point.x() - 2);
            maxX = Math.max(maxX, point.x() + 2);
            minY = Math.min(minY, point.y() - 2);
            maxY = Math.max(maxY, point.y() + 2);
        }
        boolean[][] passable = new boolean[maxX - minX + 1][maxY - minY + 1];
        for (boolean[] row : passable) {
            java.util.Arrays.fill(row, true);
        }
        for (Point2i point : blocked) {
            int x = point.x() - minX;
            int y = point.y() - minY;
            if (x >= 0 && x < passable.length && y >= 0 && y < passable[x].length) {
                passable[x][y] = false;
            }
        }
        return new PathGrid(minX, minY, passable);
    }

    private static int distanceToClosestGoal(Point2i point, List<Point2i> goals) {
        int best = Integer.MAX_VALUE;
        for (Point2i goal : goals) {
            best = Math.min(best, point.distanceTo(goal));
        }
        return best;
    }

    private static List<Point2i> reconstructPath(Map<PathStep, PathStep> previous, PathStep current) {
        ArrayDeque<Point2i> path = new ArrayDeque<>();
        path.addFirst(current.point());
        while (previous.containsKey(current)) {
            current = previous.get(current);
            path.addFirst(current.point());
        }
        return List.copyOf(path);
    }

    private static PathScore score(List<Point2i> path) {
        return new PathScore(pathLength(path), cornerCount(path));
    }

    private static List<Point2i> append(List<Point2i> points, Point2i last) {
        List<Point2i> result = new ArrayList<>(points);
        result.add(last);
        return List.copyOf(result);
    }

    private static int pathLength(List<Point2i> path) {
        return Math.max(0, path == null ? 0 : path.size() - 1);
    }

    private static int cornerCount(List<Point2i> path) {
        if (path == null || path.size() < 3) {
            return 0;
        }
        int corners = 0;
        Point2i previousDirection = path.get(1).subtract(path.get(0));
        for (int index = 2; index < path.size(); index++) {
            Point2i direction = path.get(index).subtract(path.get(index - 1));
            if (!direction.equals(previousDirection)) {
                corners++;
            }
            previousDirection = direction;
        }
        return corners;
    }

    private static int toleratedExtraDistance(int shortestDistance) {
        if (shortestDistance <= 0) {
            return 0;
        }
        return Math.max(1, (int) Math.ceil(shortestDistance * 0.10d));
    }

    private record ExitCandidate(Point2i roomCell, Point2i outsideCell, Point2i direction, Door door) {
    }

    private record ConnectionPlan(long roomId, List<Point2i> pathCells, List<Door> doors, boolean directlyAdjacent) {
        private PathScore score() {
            return CorridorPlanner.score(pathCells);
        }
    }

    private record PathScore(int distance, int corners) implements Comparable<PathScore> {
        @Override
        public int compareTo(PathScore other) {
            int cornerComparison = Integer.compare(corners, other.corners);
            if (cornerComparison != 0) {
                return cornerComparison;
            }
            return Integer.compare(distance, other.distance);
        }
    }

    private record PathGrid(int minX, int minY, boolean[][] passable) {
        private boolean isPassable(Point2i point) {
            int x = point.x() - minX;
            int y = point.y() - minY;
            return x >= 0 && x < passable.length && y >= 0 && y < passable[x].length && passable[x][y];
        }
    }

    private record PathStep(Point2i point, int directionIndex, int distance) {
    }

    private static final class MutableNetwork {
        private final Set<Long> connectedRoomIds = new LinkedHashSet<>();
        private final Set<Point2i> corridorCells = new LinkedHashSet<>();
        private final Map<VertexEdge, Door> doors = new LinkedHashMap<>();
        private boolean directlyAdjacentOnly = true;

        private void apply(ConnectionPlan plan) {
            connectedRoomIds.add(plan.roomId());
            corridorCells.addAll(plan.pathCells());
            for (Door door : plan.doors()) {
                for (VertexEdge edge : door.edges()) {
                    doors.putIfAbsent(edge, new Door(Set.of(edge)));
                }
            }
            directlyAdjacentOnly = directlyAdjacentOnly && plan.directlyAdjacent();
        }

        private NetworkScore score(List<Room> rooms) {
            return NetworkScore.forNetwork(rooms, corridorCells, doors.values());
        }

        private NetworkScore scoreWith(List<Room> rooms, ConnectionPlan candidate) {
            Set<Point2i> candidateCells = new LinkedHashSet<>(corridorCells);
            candidateCells.addAll(candidate.pathCells());
            Map<VertexEdge, Door> candidateDoors = new LinkedHashMap<>(doors);
            for (Door door : candidate.doors()) {
                for (VertexEdge edge : door.edges()) {
                    candidateDoors.putIfAbsent(edge, new Door(Set.of(edge)));
                }
            }
            return NetworkScore.forNetwork(rooms, candidateCells, candidateDoors.values());
        }
    }

    private static final class PlannerContext {
        private final List<Room> rooms;
        private final List<Point2i> waypointCells;
        private final Map<Long, ResolvedCorridorDoorBinding> doorBindings;
        private final Map<Point2i, Long> occupancy;
        private final Map<Long, List<ExitCandidate>> exitCandidatesByRoomId = new HashMap<>();

        private PlannerContext(
                List<Room> rooms,
                List<Point2i> waypointCells,
                Map<Long, ResolvedCorridorDoorBinding> doorBindings
        ) {
            this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
            this.waypointCells = waypointCells == null ? List.of() : List.copyOf(waypointCells);
            this.doorBindings = doorBindings == null ? Map.of() : Map.copyOf(doorBindings);
            this.occupancy = roomOccupancy(this.rooms);
        }

        private List<Room> rooms() {
            return rooms;
        }

        private List<Point2i> waypointCells() {
            return waypointCells;
        }

        private Map<Long, ResolvedCorridorDoorBinding> doorBindings() {
            return doorBindings;
        }

        private Map<Point2i, Long> occupancy() {
            return occupancy;
        }

        private List<ExitCandidate> exitCandidates(Room room) {
            if (room == null || room.roomId() == null) {
                return List.of();
            }
            return exitCandidatesByRoomId.computeIfAbsent(
                    room.roomId(),
                    ignored -> CorridorPlanner.exitCandidates(room, occupancy, doorBindings));
        }
    }

    private record NetworkScore(
            int componentCount,
            int unreachablePairCount,
            int distanceSum,
            int maxDistance,
            int corridorCellCount,
            int cornerCount
    ) implements Comparable<NetworkScore> {
        private static NetworkScore forNetwork(
                List<Room> rooms,
                Set<Point2i> corridorCells,
                Iterable<Door> doors
        ) {
            Map<Long, Room> roomsById = new LinkedHashMap<>();
            Map<Point2i, Long> occupancy = new LinkedHashMap<>();
            for (Room room : rooms == null ? List.<Room>of() : rooms) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                roomsById.put(room.roomId(), room);
                for (Point2i cell : room.cells()) {
                    occupancy.put(cell, room.roomId());
                }
            }
            Map<Object, Set<Object>> adjacency = new LinkedHashMap<>();
            for (Point2i cell : corridorCells) {
                link(adjacency, cell, cell);
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = cell.add(step);
                    if (corridorCells.contains(neighbor)) {
                        link(adjacency, cell, neighbor);
                    }
                }
            }
            for (Long roomId : roomsById.keySet()) {
                link(adjacency, roomNode(roomId), roomNode(roomId));
            }
            Iterable<Door> safeDoors = doors == null ? List.<Door>of() : doors;
            for (Door door : safeDoors) {
                for (VertexEdge edge : door.edges()) {
                    Set<Point2i> touchingCells = edge.touchingCells();
                    Long firstRoom = null;
                    Long secondRoom = null;
                    Point2i corridorCell = null;
                    for (Point2i cell : touchingCells) {
                        Long roomId = occupancy.get(cell);
                        if (roomId != null) {
                            if (firstRoom == null) {
                                firstRoom = roomId;
                            } else if (!Objects.equals(firstRoom, roomId)) {
                                secondRoom = roomId;
                            }
                        } else if (corridorCells.contains(cell)) {
                            corridorCell = cell;
                        }
                    }
                    if (firstRoom != null && secondRoom != null) {
                        link(adjacency, roomNode(firstRoom), roomNode(secondRoom));
                        continue;
                    }
                    if (firstRoom != null && corridorCell != null) {
                        link(adjacency, roomNode(firstRoom), corridorCell);
                    }
                }
            }
            int unreachablePairCount = 0;
            int distanceSum = 0;
            int maxDistance = 0;
            List<Long> orderedRoomIds = roomsById.keySet().stream().sorted().toList();
            for (int index = 0; index < orderedRoomIds.size(); index++) {
                Long sourceRoomId = orderedRoomIds.get(index);
                Map<Object, Integer> distances = bfs(adjacency, roomNode(sourceRoomId));
                for (int otherIndex = index + 1; otherIndex < orderedRoomIds.size(); otherIndex++) {
                    Integer distance = distances.get(roomNode(orderedRoomIds.get(otherIndex)));
                    if (distance == null) {
                        unreachablePairCount++;
                        continue;
                    }
                    distanceSum += distance;
                    maxDistance = Math.max(maxDistance, distance);
                }
            }
            return new NetworkScore(
                    CorridorPlanner.componentCount(corridorCells),
                    unreachablePairCount,
                    distanceSum,
                    maxDistance,
                    corridorCells.size(),
                    CorridorPlanner.corridorCornerCount(corridorCells));
        }

        @Override
        public int compareTo(NetworkScore other) {
            int compare = Integer.compare(componentCount, other.componentCount);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(unreachablePairCount, other.unreachablePairCount);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(distanceSum, other.distanceSum);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(maxDistance, other.maxDistance);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(cornerCount, other.cornerCount);
            if (compare != 0) {
                return compare;
            }
            return Integer.compare(corridorCellCount, other.corridorCellCount);
        }
    }

    private static Object roomNode(Long roomId) {
        return "room:" + roomId;
    }

    private static void link(Map<Object, Set<Object>> adjacency, Object left, Object right) {
        adjacency.computeIfAbsent(left, ignored -> new LinkedHashSet<>()).add(right);
        adjacency.computeIfAbsent(right, ignored -> new LinkedHashSet<>()).add(left);
    }

    private static Map<Object, Integer> bfs(Map<Object, Set<Object>> adjacency, Object start) {
        Map<Object, Integer> distanceByNode = new LinkedHashMap<>();
        ArrayDeque<Object> queue = new ArrayDeque<>();
        queue.add(start);
        distanceByNode.put(start, 0);
        while (!queue.isEmpty()) {
            Object current = queue.removeFirst();
            int currentDistance = distanceByNode.get(current);
            for (Object neighbor : adjacency.getOrDefault(current, Set.of())) {
                if (distanceByNode.containsKey(neighbor)) {
                    continue;
                }
                distanceByNode.put(neighbor, currentDistance + 1);
                queue.addLast(neighbor);
            }
        }
        return distanceByNode;
    }

    private static int componentCount(Set<Point2i> corridorCells) {
        if (corridorCells == null || corridorCells.isEmpty()) {
            return 1;
        }
        Set<Point2i> unvisited = new HashSet<>(corridorCells);
        int components = 0;
        while (!unvisited.isEmpty()) {
            Point2i seed = unvisited.iterator().next();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            components++;
            while (!queue.isEmpty()) {
                Point2i current = queue.removeFirst();
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = current.add(step);
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
        }
        return components;
    }

    private static int corridorCornerCount(Set<Point2i> corridorCells) {
        int corners = 0;
        for (Point2i cell : corridorCells == null ? Set.<Point2i>of() : corridorCells) {
            boolean horizontal = corridorCells.contains(cell.add(new Point2i(-1, 0)))
                    || corridorCells.contains(cell.add(new Point2i(1, 0)));
            boolean vertical = corridorCells.contains(cell.add(new Point2i(0, -1)))
                    || corridorCells.contains(cell.add(new Point2i(0, 1)));
            if (horizontal && vertical) {
                corners++;
            }
        }
        return corners;
    }

}
