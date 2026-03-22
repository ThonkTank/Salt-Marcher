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
import java.util.logging.Level;
import java.util.logging.Logger;

final class CorridorPlanner {

    private static final Logger LOGGER = Logger.getLogger(CorridorPlanner.class.getName());
    private static final String PROFILE_PROPERTY = "saltmarcher.dungeonmap.corridorplanner.profile";
    private static final int PATHFINDING_GRID_PADDING = 6;
    private static final int MAX_CORNER_PENALTY_TILES = 5;
    private static final int MIN_CORNER_PENALTY_TILES = 2;
    private static final int CORNER_PENALTY_RELAXATION_INTERVAL = 12;
    private static final int MAX_EXIT_CANDIDATES_PER_ROOM = 12;
    private static final int MAX_TARGETED_EXIT_CANDIDATES_PER_ROOM = 8;
    private static final int MAX_EXIT_PAIR_PATH_EVALUATIONS = 64;
    private static final int TARGETED_SIDE_NEIGHBOR_COUNT = 2;

    private CorridorPlanner() {
        throw new AssertionError("No instances");
    }

    static CorridorPath plan(Corridor corridor, CorridorPlanningInput input) {
        PlannerInstrumentation instrumentation = PlannerInstrumentation.createIfEnabled();
        long startedAt = instrumentation == null ? 0L : System.nanoTime();
        GridRoute route = resolvedRoute(corridor, input);
        try {
            if (corridor == null || input == null) {
                return CorridorPath.empty(route);
            }
            List<Room> rooms = corridor.resolvedRooms(input);
            if (rooms.size() < 2) {
                return CorridorPath.empty(route);
            }

            Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
            List<Point2i> waypointCells = corridor.resolvedWaypointCells(input);
            PlannerContext context = new PlannerContext(rooms, waypointCells, doorBindings, instrumentation);
            MutableNetwork network = bestNetwork(context);

            boolean routable = network.connectedRoomIds.size() == rooms.size()
                    && (!network.corridorCells.isEmpty() || !network.doors.isEmpty());
            return new CorridorPath(
                    route,
                    new Floor(TileShape.fromAbsoluteCells(network.corridorCells)),
                    List.copyOf(network.doors.values()),
                    network.directlyAdjacentOnly,
                    routable);
        } finally {
            if (instrumentation != null) {
                instrumentation.logSummary(System.nanoTime() - startedAt);
            }
        }
    }

    private static MutableNetwork bestNetwork(PlannerContext context) {
        MutableNetwork best = null;
        NetworkScore bestScore = null;
        for (Room seedRoom : context.rooms()) {
            if (seedRoom == null || seedRoom.roomId() == null) {
                continue;
            }
            MutableNetwork candidate = buildNetwork(seedRoom, context);
            PlannerInstrumentation instrumentation = context == null ? null : context.instrumentation();
            long startedAt = instrumentation == null ? 0L : System.nanoTime();
            NetworkScore candidateScore;
            try {
                candidateScore = candidate.score(context.rooms());
            } finally {
                if (instrumentation != null) {
                    instrumentation.recordNetworkScore(System.nanoTime() - startedAt);
                }
            }
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
        for (ExitCandidate exit : candidateExitsFor(seedRoom, new WaypointTarget(context.waypointCells()), context)) {
            List<Point2i> path = pathThroughPoints(exit.outsideCell, context.waypointCells(), context);
            if (path.isEmpty()) {
                continue;
            }
            best = better(best, new ConnectionPlan(seedRoom.roomId(), path, List.of(exit.door), false));
        }
        return best;
    }

    private static ConnectionPlan bestNextPlan(PlannerContext context, MutableNetwork network) {
        ConnectionPlan best = null;
        for (Room room : context.rooms()) {
            if (room == null || room.roomId() == null || network.connectedRoomIds.contains(room.roomId())) {
                continue;
            }
            for (ConnectionPlan candidate : connectionPlansForRoom(room, context, network)) {
                if (compareLocalCandidate(candidate, best) < 0) {
                    best = candidate;
                }
            }
        }
        return best;
    }

    private static int compareLocalCandidate(ConnectionPlan candidate, ConnectionPlan currentBest) {
        if (currentBest == null) {
            return -1;
        }
        int routeComparison = candidate.score().compareTo(currentBest.score());
        if (routeComparison != 0) {
            return routeComparison;
        }
        return Boolean.compare(currentBest.directlyAdjacent(), candidate.directlyAdjacent());
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
        }
        return List.copyOf(result);
    }

    private static ConnectionPlan bestPlanToNetwork(Room room, Set<Point2i> networkCells, PlannerContext context) {
        ConnectionPlan best = null;
        for (ExitCandidate exit : candidateExitsFor(room, new NetworkTarget(networkCells), context)) {
            List<Point2i> path = lowestCostRouteToAny(exit.outsideCell, networkCells, context);
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
        for (ExitPairCandidate pair : preselectExitPairs(room, connectedRoom, context)) {
            List<Point2i> path = normalizeSharedGapPath(
                    pair.exit().outsideCell(),
                    pair.target().outsideCell(),
                    lowestCostRoute(pair.exit().outsideCell(), pair.target().outsideCell(), context));
            if (path == null) {
                continue;
            }
            best = better(best, new ConnectionPlan(
                    room.roomId(),
                    path,
                    List.of(pair.exit().door(), pair.target().door()),
                    path.isEmpty()));
        }
        return best;
    }

    private static List<ExitPairCandidate> preselectExitPairs(
            Room room,
            Room connectedRoom,
            PlannerContext context
    ) {
        Point2i roomCenter = room.floor().shape().centerCell();
        Point2i connectedRoomCenter = connectedRoom.floor().shape().centerCell();
        List<ExitCandidate> roomExits = targetedExitCandidates(room, connectedRoomCenter, context);
        List<ExitCandidate> connectedExits = targetedExitCandidates(connectedRoom, roomCenter, context);
        if (roomExits.isEmpty() || connectedExits.isEmpty()) {
            return List.of();
        }
        List<ExitPairCandidate> rankedPairs = new ArrayList<>();
        for (ExitCandidate exit : roomExits) {
            for (ExitCandidate target : connectedExits) {
                rankedPairs.add(new ExitPairCandidate(
                        exit,
                        target,
                        exitPairHeuristic(exit, roomCenter, target, connectedRoomCenter, context.waypointCells())));
            }
        }
        rankedPairs.sort(Comparator
                .comparingInt(ExitPairCandidate::heuristicScore)
                .thenComparingInt(pair -> pair.exit().roomCell().distanceTo(roomCenter) + pair.target().roomCell().distanceTo(connectedRoomCenter))
                .thenComparingInt(pair -> pair.exit().outsideCell().distanceTo(connectedRoomCenter))
                .thenComparingInt(pair -> pair.target().outsideCell().distanceTo(roomCenter))
                .thenComparing(pair -> pair.exit().outsideCell(), Point2i.POINT_ORDER)
                .thenComparing(pair -> pair.target().outsideCell(), Point2i.POINT_ORDER));
        if (rankedPairs.size() <= MAX_EXIT_PAIR_PATH_EVALUATIONS) {
            return List.copyOf(rankedPairs);
        }
        return List.copyOf(rankedPairs.subList(0, MAX_EXIT_PAIR_PATH_EVALUATIONS));
    }

    private static List<Point2i> normalizeSharedGapPath(Point2i start, Point2i target, List<Point2i> path) {
        if (path == null) {
            return null;
        }
        if (!path.isEmpty() || start == null || target == null || !start.equals(target)) {
            return path;
        }
        return List.of(start);
    }

    private static List<ExitCandidate> candidateExitsFor(
            Room room,
            ExitSelectionTarget target,
            PlannerContext context
    ) {
        if (room == null || target == null || context == null) {
            return List.of();
        }
        List<ExitCandidate> allExits = context.allExitCandidates(room);
        if (allExits.isEmpty()) {
            return List.of();
        }
        Point2i targetCenter = switch (target) {
            case RoomTarget(Point2i centerCell) -> centerCell;
            case NetworkTarget(Set<Point2i> cells) -> centroidCell(cells);
            case WaypointTarget(List<Point2i> waypoints) -> centroidCell(waypoints);
        };
        if (targetCenter == null) {
            return limitExitCandidates(allExits);
        }
        Point2i roomCenter = room.floor().shape().centerCell();
        if (roomCenter == null) {
            return List.of();
        }
        if (allExits.size() <= MAX_TARGETED_EXIT_CANDIDATES_PER_ROOM) {
            return allExits;
        }
        Map<Point2i, ExitCandidate> selected = new LinkedHashMap<>();
        for (Point2i direction : preferredTargetDirections(roomCenter, targetCenter)) {
            addProjectedSideCandidates(selected, allExits, direction, targetCenter);
            if (selected.size() >= MAX_TARGETED_EXIT_CANDIDATES_PER_ROOM) {
                return selected.values().stream()
                        .limit(MAX_TARGETED_EXIT_CANDIDATES_PER_ROOM)
                        .toList();
            }
        }
        allExits.stream()
                .sorted(Comparator
                        .comparingInt((ExitCandidate candidate) -> targetedExitHeuristic(candidate, roomCenter, targetCenter))
                        .thenComparingInt(candidate -> candidate.outsideCell().distanceTo(targetCenter))
                        .thenComparing(candidate -> candidate.outsideCell(), Point2i.POINT_ORDER))
                .forEach(candidate -> addRepresentativeExit(selected, candidate));
        return selected.values().stream()
                .limit(MAX_TARGETED_EXIT_CANDIDATES_PER_ROOM)
                .toList();
    }

    private static List<ExitCandidate> targetedExitCandidates(Room room, Point2i targetCenter, PlannerContext context) {
        return candidateExitsFor(room, new RoomTarget(targetCenter), context);
    }

    private static List<Point2i> preferredTargetDirections(Point2i roomCenter, Point2i targetCenter) {
        if (roomCenter == null || targetCenter == null) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>(4);
        int deltaX = targetCenter.x() - roomCenter.x();
        int deltaY = targetCenter.y() - roomCenter.y();
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            addPreferredDirection(result, new Point2i(Integer.compare(deltaX, 0), 0));
            addPreferredDirection(result, new Point2i(0, Integer.compare(deltaY, 0)));
        } else {
            addPreferredDirection(result, new Point2i(0, Integer.compare(deltaY, 0)));
            addPreferredDirection(result, new Point2i(Integer.compare(deltaX, 0), 0));
        }
        addPreferredDirection(result, new Point2i(-Integer.compare(deltaX, 0), 0));
        addPreferredDirection(result, new Point2i(0, -Integer.compare(deltaY, 0)));
        return List.copyOf(result);
    }

    private static void addPreferredDirection(List<Point2i> directions, Point2i direction) {
        if (direction == null || (direction.x() == 0 && direction.y() == 0) || directions.contains(direction)) {
            return;
        }
        directions.add(direction);
    }

    private static void addProjectedSideCandidates(
            Map<Point2i, ExitCandidate> selected,
            List<ExitCandidate> allExits,
            Point2i direction,
            Point2i targetCenter
    ) {
        if (selected.size() >= MAX_TARGETED_EXIT_CANDIDATES_PER_ROOM) {
            return;
        }
        List<ExitCandidate> onSide = allExits.stream()
                .filter(candidate -> candidate.direction().equals(direction))
                .sorted(projectedSideOrder(direction, targetCenter))
                .toList();
        for (int index = 0; index < Math.min(TARGETED_SIDE_NEIGHBOR_COUNT, onSide.size()); index++) {
            addRepresentativeExit(selected, onSide.get(index));
        }
    }

    private static Comparator<ExitCandidate> projectedSideOrder(Point2i direction, Point2i targetCenter) {
        if (direction == null || targetCenter == null) {
            return Comparator.comparing(candidate -> candidate.outsideCell(), Point2i.POINT_ORDER);
        }
        if (direction.x() != 0) {
            return Comparator
                    .comparingInt((ExitCandidate candidate) -> Math.abs(candidate.roomCell().y() - targetCenter.y()))
                    .thenComparingInt(candidate -> candidate.outsideCell().distanceTo(targetCenter))
                    .thenComparing(candidate -> candidate.outsideCell(), Point2i.POINT_ORDER);
        }
        return Comparator
                .comparingInt((ExitCandidate candidate) -> Math.abs(candidate.roomCell().x() - targetCenter.x()))
                .thenComparingInt(candidate -> candidate.outsideCell().distanceTo(targetCenter))
                .thenComparing(candidate -> candidate.outsideCell(), Point2i.POINT_ORDER);
    }

    private static int targetedExitHeuristic(ExitCandidate candidate, Point2i roomCenter, Point2i targetCenter) {
        Point2i deltaToTarget = targetCenter.subtract(roomCenter);
        Point2i candidateDelta = candidate.outsideCell().subtract(roomCenter);
        int estimatedDistance = candidate.outsideCell().distanceTo(targetCenter);
        int offAxisPenalty = Math.abs(cross(candidateDelta, deltaToTarget));
        int inwardPenalty = dot(candidateDelta, deltaToTarget) < 0 ? roomCenter.distanceTo(targetCenter) : 0;
        int estimatedCorners = estimatedCornersToTarget(candidate.outsideCell(), targetCenter);
        return routeValue(estimatedDistance, estimatedCorners) + offAxisPenalty + inwardPenalty;
    }

    private static int dot(Point2i left, Point2i right) {
        return left.x() * right.x() + left.y() * right.y();
    }

    private static int cross(Point2i left, Point2i right) {
        return left.x() * right.y() - left.y() * right.x();
    }

    private static int exitPairHeuristic(
            ExitCandidate exit,
            Point2i roomCenter,
            ExitCandidate target,
            Point2i targetRoomCenter,
            List<Point2i> waypointCells
    ) {
        int directDistance = exit.outsideCell().distanceTo(target.outsideCell());
        int estimatedCorners = estimatedCornersViaWaypoints(exit, target, waypointCells);
        int sidePenalty = exit.direction().equals(target.direction()) ? cornerPenaltyTiles(directDistance) : 0;
        Point2i reverseTargetDirection = new Point2i(-target.direction().x(), -target.direction().y());
        int approachPenalty = exit.direction().equals(reverseTargetDirection) ? 0 : 1;
        int centerPenalty = exit.roomCell().distanceTo(roomCenter) + target.roomCell().distanceTo(targetRoomCenter);
        int targetAlignmentPenalty = exit.outsideCell().distanceTo(targetRoomCenter) + target.outsideCell().distanceTo(roomCenter);
        int waypointDistance = waypointRouteHeuristic(exit.outsideCell(), target.outsideCell(), waypointCells);
        int estimatedDistance = directDistance + waypointDistance;
        return routeValue(estimatedDistance, estimatedCorners + approachPenalty)
                + sidePenalty
                + centerPenalty
                + targetAlignmentPenalty;
    }

    private static int estimatedCornersToTarget(Point2i start, Point2i target) {
        if (start == null || target == null) {
            return 0;
        }
        return start.x() == target.x() || start.y() == target.y() ? 0 : 1;
    }

    private static int estimatedCornersViaWaypoints(
            ExitCandidate exit,
            ExitCandidate target,
            List<Point2i> waypointCells
    ) {
        List<Point2i> anchors = new ArrayList<>();
        anchors.add(exit.outsideCell());
        if (waypointCells != null) {
            anchors.addAll(waypointCells);
        }
        anchors.add(target.outsideCell());
        int corners = 0;
        Point2i previousDirection = null;
        for (int index = 1; index < anchors.size(); index++) {
            Point2i from = anchors.get(index - 1);
            Point2i to = anchors.get(index);
            Point2i stepDirection = dominantDirection(from, to);
            if (stepDirection == null) {
                continue;
            }
            if (previousDirection != null && !previousDirection.equals(stepDirection)) {
                corners++;
            }
            previousDirection = stepDirection;
        }
        if (previousDirection != null && !previousDirection.equals(exit.direction())) {
            corners++;
        }
        Point2i reverseTargetDirection = new Point2i(-target.direction().x(), -target.direction().y());
        if (previousDirection != null && !previousDirection.equals(reverseTargetDirection)) {
            corners++;
        }
        return corners;
    }

    private static Point2i dominantDirection(Point2i from, Point2i to) {
        if (from == null || to == null || from.equals(to)) {
            return null;
        }
        int deltaX = to.x() - from.x();
        int deltaY = to.y() - from.y();
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            return new Point2i(Integer.compare(deltaX, 0), 0);
        }
        return new Point2i(0, Integer.compare(deltaY, 0));
    }

    private static int waypointRouteHeuristic(Point2i start, Point2i target, List<Point2i> waypointCells) {
        if (waypointCells == null || waypointCells.isEmpty()) {
            return 0;
        }
        int distance = start.distanceTo(waypointCells.getFirst());
        for (int index = 1; index < waypointCells.size(); index++) {
            distance += waypointCells.get(index - 1).distanceTo(waypointCells.get(index));
        }
        distance += waypointCells.getLast().distanceTo(target);
        return distance;
    }

    private static Point2i centroidCell(Iterable<Point2i> cells) {
        if (cells == null) {
            return null;
        }
        long sumX = 0L;
        long sumY = 0L;
        int count = 0;
        for (Point2i cell : cells) {
            if (cell == null) {
                continue;
            }
            sumX += cell.x();
            sumY += cell.y();
            count++;
        }
        if (count == 0) {
            return null;
        }
        return new Point2i(
                (int) Math.round(sumX / (double) count),
                (int) Math.round(sumY / (double) count));
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

    private static List<ExitCandidate> collectExitCandidates(
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
        List<ExitCandidate> sorted = result.stream()
                .sorted(Comparator
                .comparingInt((ExitCandidate candidate) -> candidate.outsideCell.x())
                .thenComparingInt(candidate -> candidate.outsideCell.y())
                .thenComparingInt(candidate -> candidate.direction.x())
                .thenComparingInt(candidate -> candidate.direction.y()))
                .toList();
        return List.copyOf(sorted);
    }

    private static List<ExitCandidate> limitExitCandidates(List<ExitCandidate> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        List<List<ExitCandidate>> segments = new ArrayList<>();
        Map<Point2i, ExitCandidate> limited = new LinkedHashMap<>();
        for (Point2i direction : Point2i.CARDINAL_STEPS) {
            List<ExitCandidate> onSide = candidates.stream()
                    .filter(candidate -> candidate.direction().equals(direction))
                    .sorted(exitCandidateSideOrder(direction))
                    .toList();
            segments.addAll(contiguousExitSegments(onSide, direction));
        }
        if (segments.isEmpty()) {
            return List.of();
        }
        int totalCandidates = segments.stream()
                .mapToInt(List::size)
                .sum();
        int totalBudget = Math.min(MAX_EXIT_CANDIDATES_PER_ROOM, totalCandidates);
        int[] allocations = new int[segments.size()];
        int allocated = 0;
        for (int index = 0; index < segments.size() && allocated < totalBudget; index++) {
            allocations[index] = 1;
            allocated++;
        }
        while (allocated < totalBudget) {
            int bestSegmentIndex = -1;
            double bestNeed = Double.NEGATIVE_INFINITY;
            for (int index = 0; index < segments.size(); index++) {
                List<ExitCandidate> segment = segments.get(index);
                if (allocations[index] >= segment.size()) {
                    continue;
                }
                double need = ((double) segment.size() / (allocations[index] + 1)) - allocations[index];
                if (need > bestNeed) {
                    bestNeed = need;
                    bestSegmentIndex = index;
                }
            }
            if (bestSegmentIndex < 0) {
                break;
            }
            allocations[bestSegmentIndex]++;
            allocated++;
        }
        for (int index = 0; index < segments.size(); index++) {
            addDistributedSegmentSamples(limited, segments.get(index), allocations[index]);
        }
        return limited.values().stream()
                .limit(MAX_EXIT_CANDIDATES_PER_ROOM)
                .sorted(Comparator
                        .comparingInt((ExitCandidate candidate) -> candidate.outsideCell.x())
                        .thenComparingInt(candidate -> candidate.outsideCell.y())
                        .thenComparingInt(candidate -> candidate.direction.x())
                        .thenComparingInt(candidate -> candidate.direction.y()))
                .toList();
    }

    private static void addDistributedSegmentSamples(
            Map<Point2i, ExitCandidate> limited,
            List<ExitCandidate> segment,
            int sampleCount
    ) {
        if (segment == null || segment.isEmpty() || sampleCount <= 0) {
            return;
        }
        if (sampleCount >= segment.size()) {
            for (ExitCandidate candidate : segment) {
                addRepresentativeExit(limited, candidate);
            }
            return;
        }
        if (sampleCount == 1) {
            addRepresentativeExit(limited, segment.get(segment.size() / 2));
            return;
        }
        for (int sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
            int candidateIndex = (int) Math.round(sampleIndex * (segment.size() - 1.0) / (sampleCount - 1.0));
            addRepresentativeExit(limited, segment.get(candidateIndex));
        }
    }

    private static List<List<ExitCandidate>> contiguousExitSegments(List<ExitCandidate> candidates, Point2i direction) {
        if (candidates.isEmpty()) {
            return List.of();
        }
        List<List<ExitCandidate>> segments = new ArrayList<>();
        List<ExitCandidate> current = new ArrayList<>();
        ExitCandidate previous = null;
        for (ExitCandidate candidate : candidates) {
            if (previous != null && !isAdjacentOnSide(previous, candidate, direction)) {
                segments.add(List.copyOf(current));
                current = new ArrayList<>();
            }
            current.add(candidate);
            previous = candidate;
        }
        segments.add(List.copyOf(current));
        return List.copyOf(segments);
    }

    private static boolean isAdjacentOnSide(ExitCandidate previous, ExitCandidate current, Point2i direction) {
        Point2i delta = current.roomCell().subtract(previous.roomCell());
        if (direction.x() != 0) {
            return delta.x() == 0 && Math.abs(delta.y()) == 1;
        }
        return delta.y() == 0 && Math.abs(delta.x()) == 1;
    }

    private static Comparator<ExitCandidate> exitCandidateSideOrder(Point2i direction) {
        if (direction.x() != 0) {
            return Comparator
                    .comparingInt((ExitCandidate candidate) -> candidate.roomCell().y())
                    .thenComparingInt(candidate -> candidate.roomCell().x());
        }
        return Comparator
                .comparingInt((ExitCandidate candidate) -> candidate.roomCell().x())
                .thenComparingInt(candidate -> candidate.roomCell().y());
    }

    private static void addRepresentativeExit(Map<Point2i, ExitCandidate> limited, ExitCandidate candidate) {
        if (candidate == null || limited.size() >= MAX_EXIT_CANDIDATES_PER_ROOM) {
            return;
        }
        limited.putIfAbsent(candidate.outsideCell(), candidate);
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

    private static List<Point2i> pathThroughPoints(Point2i start, List<Point2i> targets, PlannerContext context) {
        if (start == null || targets == null || targets.isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        Point2i current = start;
        for (Point2i target : targets) {
            if (target == null) {
                continue;
            }
            List<Point2i> leg = lowestCostRoute(current, target, context);
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

    private static List<Point2i> lowestCostRouteToAny(Point2i start, Set<Point2i> goals, PlannerContext context) {
        return lowestCostRoute(start, goals, context);
    }

    private static List<Point2i> lowestCostRoute(Point2i start, Point2i goal, PlannerContext context) {
        if (goal == null) {
            return null;
        }
        return lowestCostRoute(start, Set.of(goal), context);
    }

    private static List<Point2i> lowestCostRoute(Point2i start, Set<Point2i> goals, PlannerContext context) {
        PlannerInstrumentation instrumentation = context == null ? null : context.instrumentation();
        long startedAt = instrumentation == null ? 0L : System.nanoTime();
        if (instrumentation != null) {
            instrumentation.recordRouteSearchCall();
        }
        try {
            if (start == null || goals == null || goals.isEmpty() || context == null) {
                return null;
            }
            Map<Point2i, Long> roomOccupancy = context.occupancy();
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
            PathGrid grid = context.pathfindingSpace().gridFor(start, goalList, PATHFINDING_GRID_PADDING);
            record QueueNode(PathNode node) {}
            PriorityQueue<QueueNode> open = new PriorityQueue<>(Comparator
                    .comparing((QueueNode queueNode) -> queueNode.node().score())
                    .thenComparingInt(queueNode -> distanceToClosestGoal(queueNode.node().state().point(), goalList)));
            // The visit identity is cell + incoming direction only. Distance stays in the score so a slightly longer
            // variant of the same state cannot force arbitrary re-expansion unless it improves the dominant score.
            Map<PathState, RouteCost> bestCostByState = new HashMap<>();
            Map<PathState, PathState> previous = new HashMap<>();
            PathNode startNode = new PathNode(new PathState(start, -1), new RouteCost(0, 0));
            open.add(new QueueNode(startNode));
            bestCostByState.put(startNode.state(), startNode.score());

            PathNode bestGoalNode = null;
            RouteCost bestGoalCost = null;
            while (!open.isEmpty()) {
                PathNode node = open.poll().node();
                RouteCost currentBestCost = bestCostByState.get(node.state());
                if (currentBestCost == null || !currentBestCost.equals(node.score())) {
                    continue;
                }
                if (goalList.contains(node.state().point())) {
                    if (bestGoalCost == null || node.score().compareTo(bestGoalCost) < 0) {
                        bestGoalNode = node;
                        bestGoalCost = node.score();
                    }
                    continue;
                }
                for (int directionIndex = 0; directionIndex < Point2i.CARDINAL_STEPS.size(); directionIndex++) {
                    Point2i next = node.state().point().add(Point2i.CARDINAL_STEPS.get(directionIndex));
                    boolean nextIsGoal = goalList.contains(next);
                    if (!grid.isPassable(next) && !nextIsGoal) {
                        continue;
                    }
                    int nextDistance = node.score().distance() + 1;
                    int nextCorners = node.state().directionIndex() < 0 || node.state().directionIndex() == directionIndex
                            ? node.score().corners()
                            : node.score().corners() + 1;
                    PathState nextState = new PathState(next, directionIndex);
                    RouteCost nextCost = new RouteCost(nextDistance, nextCorners);
                    if (!improves(bestCostByState.get(nextState), nextCost)) {
                        continue;
                    }
                    int optimisticRemainingDistance = distanceToClosestGoal(next, goalList);
                    RouteCost optimisticCost = nextCost.optimisticCompletion(optimisticRemainingDistance);
                    if (bestGoalCost != null && !improves(bestGoalCost, optimisticCost)) {
                        continue;
                    }
                    bestCostByState.put(nextState, nextCost);
                    previous.put(nextState, node.state());
                    open.add(new QueueNode(new PathNode(nextState, nextCost)));
                }
            }
            return bestGoalNode == null ? null : reconstructPath(previous, bestGoalNode.state());
        } finally {
            if (instrumentation != null) {
                instrumentation.recordRouteSearchNanos(System.nanoTime() - startedAt);
            }
        }
    }

    private static PathfindingSpace buildPathfindingSpace(Set<Point2i> blocked) {
        if (blocked == null || blocked.isEmpty()) {
            return PathfindingSpace.empty();
        }
        int minX = Integer.MAX_VALUE;
        int maxX = Integer.MIN_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxY = Integer.MIN_VALUE;
        for (Point2i point : blocked) {
            minX = Math.min(minX, point.x());
            maxX = Math.max(maxX, point.x());
            minY = Math.min(minY, point.y());
            maxY = Math.max(maxY, point.y());
        }
        boolean[][] blockedCells = new boolean[maxX - minX + 1][maxY - minY + 1];
        for (Point2i point : blocked) {
            blockedCells[point.x() - minX][point.y() - minY] = true;
        }
        return new PathfindingSpace(minX, minY, maxX, maxY, blockedCells);
    }

    private static PathGrid buildPathfindingGrid(PathfindingSpace blockedSpace, Point2i start, Iterable<Point2i> goals, int padding) {
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
        if (!blockedSpace.isEmpty()) {
            minX = Math.min(minX, blockedSpace.minX() - 2);
            maxX = Math.max(maxX, blockedSpace.maxX() + 2);
            minY = Math.min(minY, blockedSpace.minY() - 2);
            maxY = Math.max(maxY, blockedSpace.maxY() + 2);
        }
        return new PathGrid(minX, minY, maxX, maxY, blockedSpace);
    }

    private static int distanceToClosestGoal(Point2i point, List<Point2i> goals) {
        int best = Integer.MAX_VALUE;
        for (Point2i goal : goals) {
            best = Math.min(best, point.distanceTo(goal));
        }
        return best;
    }

    private static List<Point2i> reconstructPath(Map<PathState, PathState> previous, PathState current) {
        ArrayDeque<Point2i> path = new ArrayDeque<>();
        path.addFirst(current.point());
        while (previous.containsKey(current)) {
            current = previous.get(current);
            path.addFirst(current.point());
        }
        return List.copyOf(path);
    }

    private static RouteCost score(List<Point2i> path) {
        return new RouteCost(pathLength(path), cornerCount(path));
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

    private static boolean improves(RouteCost bestKnownCost, RouteCost candidateCost) {
        return bestKnownCost == null || candidateCost.compareTo(bestKnownCost) < 0;
    }

    private static int compareRoutePriority(int distance, int corners, int otherDistance, int otherCorners) {
        int valueComparison = Integer.compare(routeValue(distance, corners), routeValue(otherDistance, otherCorners));
        if (valueComparison != 0) {
            return valueComparison;
        }
        int cornerComparison = Integer.compare(corners, otherCorners);
        if (cornerComparison != 0) {
            return cornerComparison;
        }
        return Integer.compare(distance, otherDistance);
    }

    private static int routeValue(int distance, int corners) {
        return distance + corners * cornerPenaltyTiles(distance);
    }

    private static int cornerPenaltyTiles(int distance) {
        if (distance <= 0) {
            return MAX_CORNER_PENALTY_TILES;
        }
        int relaxedPenalty = MAX_CORNER_PENALTY_TILES - (distance / CORNER_PENALTY_RELAXATION_INTERVAL);
        return Math.max(MIN_CORNER_PENALTY_TILES, relaxedPenalty);
    }

    private record ExitPairCandidate(ExitCandidate exit, ExitCandidate target, int heuristicScore) {
    }

    private sealed interface ExitSelectionTarget permits RoomTarget, NetworkTarget, WaypointTarget {
    }

    private record RoomTarget(Point2i centerCell) implements ExitSelectionTarget {
    }

    private record NetworkTarget(Set<Point2i> cells) implements ExitSelectionTarget {
    }

    private record WaypointTarget(List<Point2i> waypoints) implements ExitSelectionTarget {
    }

    private record ExitCandidate(Point2i roomCell, Point2i outsideCell, Point2i direction, Door door) {
    }

    private record ConnectionPlan(long roomId, List<Point2i> pathCells, List<Door> doors, boolean directlyAdjacent) {
        private RouteCost score() {
            return CorridorPlanner.score(pathCells);
        }
    }

    private record RouteCost(int distance, int corners) implements Comparable<RouteCost> {
        private RouteCost optimisticCompletion(int remainingDistance) {
            return new RouteCost(distance + Math.max(0, remainingDistance), corners);
        }

        @Override
        public int compareTo(RouteCost other) {
            // Each corner must buy enough tile savings to offset its current route-length penalty.
            return compareRoutePriority(distance, corners, other.distance, other.corners);
        }
    }

    private record PathGrid(int minX, int minY, int maxX, int maxY, PathfindingSpace blockedSpace) {
        private boolean isPassable(Point2i point) {
            return point.x() >= minX
                    && point.x() <= maxX
                    && point.y() >= minY
                    && point.y() <= maxY
                    && !blockedSpace.isBlocked(point);
        }
    }

    private record PathfindingSpace(int minX, int minY, int maxX, int maxY, boolean[][] blockedCells) {
        private static PathfindingSpace empty() {
            return new PathfindingSpace(0, 0, -1, -1, new boolean[0][0]);
        }

        private boolean isEmpty() {
            return blockedCells.length == 0;
        }

        private boolean isBlocked(Point2i point) {
            if (isEmpty()) {
                return false;
            }
            int x = point.x() - minX;
            int y = point.y() - minY;
            return x >= 0
                    && x < blockedCells.length
                    && y >= 0
                    && y < blockedCells[x].length
                    && blockedCells[x][y];
        }

        private PathGrid gridFor(Point2i start, Iterable<Point2i> goals, int padding) {
            return buildPathfindingGrid(this, start, goals, padding);
        }
    }

    private record PathState(Point2i point, int directionIndex) {
    }

    private record PathNode(PathState state, RouteCost score) {
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
    }

    private static final class PlannerContext {
        private final List<Room> rooms;
        private final List<Point2i> waypointCells;
        private final Map<Long, ResolvedCorridorDoorBinding> doorBindings;
        private final Map<Point2i, Long> occupancy;
        private final PathfindingSpace pathfindingSpace;
        private final PlannerInstrumentation instrumentation;
        private final Map<Long, List<ExitCandidate>> allExitCandidatesByRoomId = new HashMap<>();

        private PlannerContext(
                List<Room> rooms,
                List<Point2i> waypointCells,
                Map<Long, ResolvedCorridorDoorBinding> doorBindings,
                PlannerInstrumentation instrumentation
        ) {
            this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
            this.waypointCells = waypointCells == null ? List.of() : List.copyOf(waypointCells);
            this.doorBindings = doorBindings == null ? Map.of() : Map.copyOf(doorBindings);
            this.occupancy = roomOccupancy(this.rooms);
            // Future performance track only: if drag-preview profiling shows long-corridor pressure,
            // this occupancy/grid setup is the first candidate for per-drag-session reuse.
            this.pathfindingSpace = buildPathfindingSpace(this.occupancy.keySet());
            this.instrumentation = instrumentation;
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

        private PathfindingSpace pathfindingSpace() {
            return pathfindingSpace;
        }

        private PlannerInstrumentation instrumentation() {
            return instrumentation;
        }

        private List<ExitCandidate> allExitCandidates(Room room) {
            if (room == null || room.roomId() == null) {
                return List.of();
            }
            return allExitCandidatesByRoomId.computeIfAbsent(
                    room.roomId(),
                    ignored -> {
                        List<ExitCandidate> candidates = CorridorPlanner.collectExitCandidates(room, occupancy, doorBindings);
                        if (instrumentation != null) {
                            instrumentation.recordExitCandidateCount(room.roomId(), candidates.size());
                        }
                        return candidates;
                    });
        }
    }

    private static final class PlannerInstrumentation {
        private final Map<Long, Integer> exitCandidateCountByRoomId = new LinkedHashMap<>();
        private int routeSearchCalls = 0;
        private long routeSearchNanos = 0L;
        private int networkScoreCalls = 0;
        private long networkScoreNanos = 0L;

        private static PlannerInstrumentation createIfEnabled() {
            return Boolean.getBoolean(PROFILE_PROPERTY) ? new PlannerInstrumentation() : null;
        }

        private void recordExitCandidateCount(Long roomId, int count) {
            if (roomId != null) {
                exitCandidateCountByRoomId.put(roomId, count);
            }
        }

        private void recordRouteSearchCall() {
            routeSearchCalls++;
        }

        private void recordRouteSearchNanos(long nanos) {
            routeSearchNanos += nanos;
        }

        private void recordNetworkScore(long nanos) {
            networkScoreCalls++;
            networkScoreNanos += nanos;
        }

        private void logSummary(long totalPlanNanos) {
            LOGGER.log(
                    Level.INFO,
                    () -> "CorridorPlanner profile: totalMs=" + formatMillis(totalPlanNanos)
                            + ", routeSearchCalls=" + routeSearchCalls
                            + ", routeSearchMs=" + formatMillis(routeSearchNanos)
                            + ", networkScoreCalls=" + networkScoreCalls
                            + ", networkScoreMs=" + formatMillis(networkScoreNanos)
                            + ", exitCandidatesByRoomId=" + exitCandidateCountByRoomId);
        }

        private static String formatMillis(long nanos) {
            return String.format(java.util.Locale.ROOT, "%.3f", nanos / 1_000_000.0d);
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
        private int routeValue() {
            return CorridorPlanner.routeValue(corridorCellCount, cornerCount);
        }

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
            List<Set<Point2i>> corridorComponents = corridorComponents(corridorCells);
            Map<Point2i, Integer> componentIndexByCell = new HashMap<>();
            for (int componentIndex = 0; componentIndex < corridorComponents.size(); componentIndex++) {
                for (Point2i cell : corridorComponents.get(componentIndex)) {
                    componentIndexByCell.put(cell, componentIndex);
                }
            }
            Map<Integer, Map<Long, Set<Point2i>>> attachmentCellsByComponentAndRoom = new HashMap<>();
            Set<RoomPair> directRoomPairs = new HashSet<>();
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
                        directRoomPairs.add(RoomPair.of(firstRoom, secondRoom));
                        continue;
                    }
                    if (firstRoom != null && corridorCell != null) {
                        Integer componentIndex = componentIndexByCell.get(corridorCell);
                        if (componentIndex != null) {
                            attachmentCellsByComponentAndRoom
                                    .computeIfAbsent(componentIndex, ignored -> new HashMap<>())
                                    .computeIfAbsent(firstRoom, ignored -> new LinkedHashSet<>())
                                    .add(corridorCell);
                        }
                    }
                }
            }
            int unreachablePairCount = 0;
            int distanceSum = 0;
            int maxDistance = 0;
            List<Long> orderedRoomIds = roomsById.keySet().stream().sorted().toList();
            for (int index = 0; index < orderedRoomIds.size(); index++) {
                Long sourceRoomId = orderedRoomIds.get(index);
                for (int otherIndex = index + 1; otherIndex < orderedRoomIds.size(); otherIndex++) {
                    Long targetRoomId = orderedRoomIds.get(otherIndex);
                    Integer distance = connectionDistance(
                            sourceRoomId,
                            targetRoomId,
                            directRoomPairs,
                            attachmentCellsByComponentAndRoom);
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
            compare = compareRoutePriority(corridorCellCount, cornerCount, other.corridorCellCount, other.cornerCount);
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
            return Integer.compare(routeValue(), other.routeValue());
        }
    }

    private static Integer connectionDistance(
            Long sourceRoomId,
            Long targetRoomId,
            Set<RoomPair> directRoomPairs,
            Map<Integer, Map<Long, Set<Point2i>>> attachmentCellsByComponentAndRoom
    ) {
        if (directRoomPairs.contains(RoomPair.of(sourceRoomId, targetRoomId))) {
            return 1;
        }
        Integer best = null;
        for (Map<Long, Set<Point2i>> attachmentsByRoom : attachmentCellsByComponentAndRoom.values()) {
            Set<Point2i> sourceAttachments = attachmentsByRoom.get(sourceRoomId);
            Set<Point2i> targetAttachments = attachmentsByRoom.get(targetRoomId);
            if (sourceAttachments == null || targetAttachments == null) {
                continue;
            }
            int distance = minimumAttachmentDistance(sourceAttachments, targetAttachments);
            if (best == null || distance < best) {
                best = distance;
            }
        }
        return best;
    }

    private static int minimumAttachmentDistance(Set<Point2i> sourceAttachments, Set<Point2i> targetAttachments) {
        int best = Integer.MAX_VALUE;
        for (Point2i source : sourceAttachments) {
            for (Point2i target : targetAttachments) {
                best = Math.min(best, source.distanceTo(target) + 2);
            }
        }
        return best;
    }

    private static List<Set<Point2i>> corridorComponents(Set<Point2i> corridorCells) {
        if (corridorCells == null || corridorCells.isEmpty()) {
            return List.of();
        }
        List<Set<Point2i>> components = new ArrayList<>();
        Set<Point2i> unvisited = new LinkedHashSet<>(corridorCells);
        while (!unvisited.isEmpty()) {
            Point2i start = unvisited.iterator().next();
            Set<Point2i> component = new LinkedHashSet<>();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            queue.add(start);
            unvisited.remove(start);
            while (!queue.isEmpty()) {
                Point2i cell = queue.removeFirst();
                component.add(cell);
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = cell.add(step);
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(Set.copyOf(component));
        }
        return List.copyOf(components);
    }

    private record RoomPair(Long firstRoomId, Long secondRoomId) {
        private static RoomPair of(Long firstRoomId, Long secondRoomId) {
            if (firstRoomId == null || secondRoomId == null) {
                return new RoomPair(firstRoomId, secondRoomId);
            }
            return firstRoomId <= secondRoomId
                    ? new RoomPair(firstRoomId, secondRoomId)
                    : new RoomPair(secondRoomId, firstRoomId);
        }
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
