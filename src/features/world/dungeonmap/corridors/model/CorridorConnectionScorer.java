package features.world.dungeonmap.corridors.model;
import features.world.dungeonmap.foundation.geometry.Point2i;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.*;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class CorridorConnectionScorer {

    private CorridorConnectionScorer() {
        throw new AssertionError("No instances");
    }

    static GraphSnapshot graphSnapshot(
            Collection<GridSegment> segments,
            Collection<DoorSegment> doors
    ) {
        Map<NetworkNode, Set<NetworkNode>> networkGraph = new HashMap<>();
        Map<CorridorNode, Set<CorridorNode>> corridorGraph = new HashMap<>();
        addSegments(networkGraph, corridorGraph, segments);
        addDoors(networkGraph, corridorGraph, doors);
        return new GraphSnapshot(immutableGraph(networkGraph), immutableGraph(corridorGraph));
    }

    static CorridorNetworkScore scoreNetwork(
            Collection<Long> roomIds,
            Collection<GridSegment> segments,
            Collection<DoorSegment> doors
    ) {
        return scoreNetwork(graphSnapshot(segments, doors), emptyGraphSnapshot(), roomIds);
    }

    static CorridorNetworkScore scoreConnection(
            GraphSnapshot baseGraph,
            Collection<Long> connectedRoomIds,
            long candidateRoomId,
            List<Point2i> candidatePath,
            List<DoorSegment> candidateDoors
    ) {
        LinkedHashSet<Long> roomIds = new LinkedHashSet<>(connectedRoomIds);
        roomIds.add(candidateRoomId);
        GraphSnapshot candidateGraph = graphSnapshot(CorridorRouteGeometry.segmentsForPath(candidatePath), candidateDoors);
        return scoreNetwork(baseGraph, candidateGraph, roomIds);
    }

    private static CorridorNetworkScore scoreNetwork(
            GraphSnapshot baseGraph,
            GraphSnapshot candidateGraph,
            Collection<Long> roomIds
    ) {
        List<Long> orderedRoomIds = roomIds == null
                ? List.of()
                : roomIds.stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        int unreachablePairCount = 0;
        int distanceSum = 0;
        int maxDistance = 0;
        for (int index = 0; index < orderedRoomIds.size(); index++) {
            long sourceRoomId = orderedRoomIds.get(index);
            Map<NetworkNode, Integer> distances = GraphTraversal.bfsDistances(
                    NetworkNode.room(sourceRoomId),
                    baseGraph.adjacency(),
                    candidateGraph.adjacency());
            for (int otherIndex = index + 1; otherIndex < orderedRoomIds.size(); otherIndex++) {
                long targetRoomId = orderedRoomIds.get(otherIndex);
                Integer distance = distances.get(NetworkNode.room(targetRoomId));
                if (distance == null) {
                    unreachablePairCount++;
                    continue;
                }
                distanceSum += distance;
                maxDistance = Math.max(maxDistance, distance);
            }
        }
        return new CorridorNetworkScore(
                GraphTraversal.componentCount(baseGraph.corridorAdjacency(), candidateGraph.corridorAdjacency()),
                unreachablePairCount,
                distanceSum,
                maxDistance);
    }

    private static void addSegments(
            Map<NetworkNode, Set<NetworkNode>> networkGraph,
            Map<CorridorNode, Set<CorridorNode>> corridorGraph,
            Collection<GridSegment> segments
    ) {
        for (GridSegment segment : segments) {
            addEdgePair(networkGraph, corridorGraph,
                    NetworkNode.cell(segment.from()), NetworkNode.cell(segment.to()),
                    CorridorNode.cell(segment.from()), CorridorNode.cell(segment.to()));
        }
    }

    private static void addDoors(
            Map<NetworkNode, Set<NetworkNode>> networkGraph,
            Map<CorridorNode, Set<CorridorNode>> corridorGraph,
            Collection<DoorSegment> doors
    ) {
        Map<UndirectedDoorKey, List<DoorSegment>> doorsByKey = new HashMap<>();
        for (DoorSegment door : doors) {
            doorsByKey.computeIfAbsent(UndirectedDoorKey.of(door), ignored -> new ArrayList<>()).add(door);
        }
        for (Map.Entry<UndirectedDoorKey, List<DoorSegment>> entry : doorsByKey.entrySet()) {
            List<DoorSegment> groupedDoors = entry.getValue();
            if (groupedDoors.size() >= 2) {
                corridorGraph.computeIfAbsent(CorridorNode.sharedDoor(entry.getKey()), ignored -> new LinkedHashSet<>());
                for (int index = 0; index < groupedDoors.size(); index++) {
                    for (int otherIndex = index + 1; otherIndex < groupedDoors.size(); otherIndex++) {
                        DoorSegment left = groupedDoors.get(index);
                        DoorSegment right = groupedDoors.get(otherIndex);
                        if (left.roomId() != right.roomId()) {
                            addGraphEdge(networkGraph, NetworkNode.room(left.roomId()), NetworkNode.room(right.roomId()));
                        }
                    }
                }
                continue;
            }

            DoorSegment door = groupedDoors.getFirst();
            Point2i outsideCell = CorridorRouteGeometry.outsideCellForDoor(door);
            addGraphEdge(networkGraph, NetworkNode.room(door.roomId()), NetworkNode.cell(outsideCell));
            corridorGraph.computeIfAbsent(CorridorNode.cell(outsideCell), ignored -> new LinkedHashSet<>());
        }
    }

    private static void addEdgePair(
            Map<NetworkNode, Set<NetworkNode>> networkGraph,
            Map<CorridorNode, Set<CorridorNode>> corridorGraph,
            NetworkNode networkFrom,
            NetworkNode networkTo,
            CorridorNode corridorFrom,
            CorridorNode corridorTo
    ) {
        addGraphEdge(networkGraph, networkFrom, networkTo);
        addGraphEdge(corridorGraph, corridorFrom, corridorTo);
    }

    private static <T> void addGraphEdge(
            Map<T, Set<T>> graph,
            T from,
            T to
    ) {
        graph.computeIfAbsent(from, ignored -> new LinkedHashSet<>()).add(to);
        graph.computeIfAbsent(to, ignored -> new LinkedHashSet<>()).add(from);
    }

    private static <T> Map<T, Set<T>> immutableGraph(Map<T, Set<T>> source) {
        Map<T, Set<T>> copy = new HashMap<>();
        for (Map.Entry<T, Set<T>> entry : source.entrySet()) {
            copy.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(copy);
    }

    private static GraphSnapshot emptyGraphSnapshot() {
        return new GraphSnapshot(Map.of(), Map.of());
    }

    private static final class GraphTraversal {

        private GraphTraversal() {
            throw new AssertionError("No instances");
        }

        @SafeVarargs
        static Map<NetworkNode, Integer> bfsDistances(
                NetworkNode start,
                Map<NetworkNode, Set<NetworkNode>>... graphs
        ) {
            ArrayDeque<NetworkNode> queue = new ArrayDeque<>();
            Map<NetworkNode, Integer> distances = new HashMap<>();
            queue.add(start);
            distances.put(start, 0);
            while (!queue.isEmpty()) {
                NetworkNode current = queue.removeFirst();
                int currentDistance = distances.get(current);
                for (Map<NetworkNode, Set<NetworkNode>> graph : graphs) {
                    for (NetworkNode next : graph.getOrDefault(current, Set.of())) {
                        if (!distances.containsKey(next)) {
                            distances.put(next, currentDistance + 1);
                            queue.addLast(next);
                        }
                    }
                }
            }
            return distances;
        }

        @SafeVarargs
        static int componentCount(
                Map<CorridorNode, Set<CorridorNode>>... graphs
        ) {
            boolean allEmpty = true;
            for (Map<CorridorNode, Set<CorridorNode>> graph : graphs) {
                if (!graph.isEmpty()) {
                    allEmpty = false;
                    break;
                }
            }
            if (allEmpty) {
                return 0;
            }
            Set<CorridorNode> visited = new LinkedHashSet<>();
            LinkedHashSet<CorridorNode> allNodes = new LinkedHashSet<>();
            for (Map<CorridorNode, Set<CorridorNode>> graph : graphs) {
                allNodes.addAll(graph.keySet());
            }
            int components = 0;
            for (CorridorNode node : allNodes) {
                if (!visited.add(node)) {
                    continue;
                }
                components++;
                ArrayDeque<CorridorNode> queue = new ArrayDeque<>();
                queue.add(node);
                while (!queue.isEmpty()) {
                    CorridorNode current = queue.removeFirst();
                    for (Map<CorridorNode, Set<CorridorNode>> graph : graphs) {
                        for (CorridorNode next : graph.getOrDefault(current, Set.of())) {
                            if (visited.add(next)) {
                                queue.addLast(next);
                            }
                        }
                    }
                }
            }
            return components;
        }
    }

    private sealed interface NetworkNode permits RoomNode, CellNode {
        static NetworkNode room(long roomId) {
            return new RoomNode(roomId);
        }

        static NetworkNode cell(Point2i cell) {
            return new CellNode(cell);
        }
    }

    private sealed interface CorridorNode permits CorridorCellNode, SharedDoorNode {
        static CorridorNode cell(Point2i cell) {
            return new CorridorCellNode(cell);
        }

        static CorridorNode sharedDoor(UndirectedDoorKey key) {
            return new SharedDoorNode(key);
        }
    }

    private record RoomNode(long roomId) implements NetworkNode {
    }

    private record CellNode(Point2i cell) implements NetworkNode {
    }

    private record CorridorCellNode(Point2i cell) implements CorridorNode {
    }

    private record SharedDoorNode(UndirectedDoorKey key) implements CorridorNode {
    }

    private record UndirectedDoorKey(Point2i first, Point2i second) {
        private static UndirectedDoorKey of(DoorSegment door) {
            Point2i start = door.start();
            Point2i end = door.end();
            if (start.x() < end.x() || (start.x() == end.x() && start.y() <= end.y())) {
                return new UndirectedDoorKey(start, end);
            }
            return new UndirectedDoorKey(end, start);
        }
    }

    record GraphSnapshot(
            Map<NetworkNode, Set<NetworkNode>> adjacency,
            Map<CorridorNode, Set<CorridorNode>> corridorAdjacency
    ) {
    }
}

record CorridorNetworkScore(
        int corridorComponentCount,
        int unreachablePairCount,
        int distanceSum,
        int maxDistance
) implements Comparable<CorridorNetworkScore> {
    @Override
    public int compareTo(CorridorNetworkScore other) {
        int componentComparison = Integer.compare(corridorComponentCount, other.corridorComponentCount);
        if (componentComparison != 0) {
            return componentComparison;
        }
        int unreachableComparison = Integer.compare(unreachablePairCount, other.unreachablePairCount);
        if (unreachableComparison != 0) {
            return unreachableComparison;
        }
        int distanceComparison = Integer.compare(distanceSum, other.distanceSum);
        if (distanceComparison != 0) {
            return distanceComparison;
        }
        return Integer.compare(maxDistance, other.maxDistance);
    }
}
