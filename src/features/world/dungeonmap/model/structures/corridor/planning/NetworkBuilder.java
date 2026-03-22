package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class NetworkBuilder {

    private NetworkBuilder() {
    }

    static MutableNetwork bestNetwork(PlannerContext context, PlannerConfig config) {
        MutableNetwork best = null;
        NetworkScorer.NetworkScore bestScore = null;
        for (Room seedRoom : context.rooms()) {
            if (seedRoom == null || seedRoom.roomId() == null) {
                continue;
            }
            MutableNetwork candidate = buildNetwork(seedRoom, context, config);
            PlannerInstrumentation instrumentation = context.instrumentation();
            long startedAt = instrumentation == null ? 0L : System.nanoTime();
            NetworkScorer.NetworkScore candidateScore;
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

    private static MutableNetwork buildNetwork(Room seedRoom, PlannerContext context, PlannerConfig config) {
        MutableNetwork network = new MutableNetwork();
        network.connectedRoomIds.add(seedRoom.roomId());
        if (!context.waypointCells().isEmpty()) {
            ConnectionPlan seedPlan = bestSeedWaypointPlan(seedRoom, context, config);
            if (seedPlan != null) {
                network.apply(seedPlan);
            }
        }
        while (network.connectedRoomIds.size() < context.rooms().size()) {
            ConnectionPlan next = bestNextPlan(context, network, config);
            if (next == null) {
                break;
            }
            network.apply(next);
        }
        return network;
    }

    private static ConnectionPlan bestSeedWaypointPlan(Room seedRoom, PlannerContext context, PlannerConfig config) {
        ConnectionPlan best = null;
        for (ExitCandidate exit : ExitCandidateSelector.candidateExitsFor(
                seedRoom,
                new WaypointTarget(context.waypointCells()),
                context,
                config)) {
            List<Point2i> path = RouteSearch.pathThroughPoints(exit.outsideCell(), context.waypointCells(), context);
            if (path.isEmpty()) {
                continue;
            }
            best = better(best, new ConnectionPlan(seedRoom.roomId(), path, List.of(exit.door()), false));
        }
        return best;
    }

    private static ConnectionPlan bestNextPlan(PlannerContext context, MutableNetwork network, PlannerConfig config) {
        ConnectionPlan best = null;
        for (Room room : context.rooms()) {
            if (room == null || room.roomId() == null || network.connectedRoomIds.contains(room.roomId())) {
                continue;
            }
            for (ConnectionPlan candidate : connectionPlansForRoom(room, context, network, config)) {
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

    private static List<ConnectionPlan> connectionPlansForRoom(
            Room room,
            PlannerContext context,
            MutableNetwork network,
            PlannerConfig config
    ) {
        List<ConnectionPlan> result = new java.util.ArrayList<>();
        if (network.corridorCells.isEmpty()) {
            for (Room connectedRoom : context.rooms()) {
                if (connectedRoom == null || !network.connectedRoomIds.contains(connectedRoom.roomId())) {
                    continue;
                }
                ConnectionPlan candidate = bestPlanToConnectedRoom(room, connectedRoom, context, config);
                if (candidate != null) {
                    result.add(candidate);
                }
            }
        } else {
            ConnectionPlan joinNetwork = bestPlanToNetwork(room, network.corridorCells, context, config);
            if (joinNetwork != null) {
                result.add(joinNetwork);
            }
        }
        return List.copyOf(result);
    }

    private static ConnectionPlan bestPlanToNetwork(
            Room room,
            Set<Point2i> networkCells,
            PlannerContext context,
            PlannerConfig config
    ) {
        ConnectionPlan best = null;
        for (ExitCandidate exit : ExitCandidateSelector.candidateExitsFor(
                room,
                new NetworkTarget(networkCells),
                context,
                config)) {
            List<Point2i> path = RouteSearch.lowestCostRouteToAny(exit.outsideCell(), networkCells, context);
            if (path == null) {
                continue;
            }
            best = better(best, new ConnectionPlan(room.roomId(), path, List.of(exit.door()), path.isEmpty()));
        }
        return best;
    }

    private static ConnectionPlan bestPlanToConnectedRoom(
            Room room,
            Room connectedRoom,
            PlannerContext context,
            PlannerConfig config
    ) {
        if (room == null || connectedRoom == null || Objects.equals(room.roomId(), connectedRoom.roomId())) {
            return null;
        }
        ConnectionPlan best = directAdjacencyPlan(room, connectedRoom, context.doorBindings());
        for (ExitPairCandidate pair : ExitCandidateSelector.preselectExitPairs(room, connectedRoom, context, config)) {
            List<Point2i> path = normalizeSharedGapPath(
                    pair.exit().outsideCell(),
                    pair.target().outsideCell(),
                    RouteSearch.lowestCostRoute(pair.exit().outsideCell(), pair.target().outsideCell(), context));
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

    private static List<Point2i> normalizeSharedGapPath(Point2i start, Point2i target, List<Point2i> path) {
        if (path == null) {
            return null;
        }
        if (!path.isEmpty() || start == null || target == null || !start.equals(target)) {
            return path;
        }
        return List.of(start);
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

    private static ConnectionPlan better(ConnectionPlan current, ConnectionPlan candidate) {
        if (candidate == null) {
            return current;
        }
        if (current == null) {
            return candidate;
        }
        return candidate.score().compareTo(current.score()) < 0 ? candidate : current;
    }
}

final class MutableNetwork {
    final Set<Long> connectedRoomIds = new LinkedHashSet<>();
    final Set<Point2i> corridorCells = new LinkedHashSet<>();
    final Map<VertexEdge, Door> doors = new LinkedHashMap<>();
    boolean directlyAdjacentOnly = true;

    void apply(ConnectionPlan plan) {
        connectedRoomIds.add(plan.roomId());
        corridorCells.addAll(plan.pathCells());
        for (Door door : plan.doors()) {
            for (VertexEdge edge : door.edges()) {
                doors.putIfAbsent(edge, new Door(Set.of(edge)));
            }
        }
        directlyAdjacentOnly = directlyAdjacentOnly && plan.directlyAdjacent();
    }

    NetworkScorer.NetworkScore score(List<Room> rooms) {
        return NetworkScorer.NetworkScore.forNetwork(rooms, corridorCells, doors.values());
    }
}

record ConnectionPlan(long roomId, List<Point2i> pathCells, List<Door> doors, boolean directlyAdjacent) {
    RouteCost score() {
        return RouteSearch.score(pathCells);
    }
}
