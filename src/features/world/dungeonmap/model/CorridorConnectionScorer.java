package features.world.dungeonmap.model;

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
            Collection<GridSegment> baseSegments,
            Collection<DoorSegment> baseDoors
    ) {
        Map<NetworkNode, Set<NetworkNode>> graph = new HashMap<>();
        addSegments(graph, baseSegments);
        addDoors(graph, baseDoors);
        return new GraphSnapshot(graph);
    }

    static CorridorStepScore scoreConnection(
            GraphSnapshot baseGraph,
            Collection<Long> connectedRoomIds,
            long candidateRoomId,
            List<Point2i> candidatePath,
            List<DoorSegment> candidateDoors
    ) {
        Map<NetworkNode, Set<NetworkNode>> candidateGraph = new HashMap<>();
        addSegments(candidateGraph, DungeonCorridorGeometry.segmentsForPath(candidatePath));
        addDoors(candidateGraph, candidateDoors);

        Map<NetworkNode, Integer> distances = shortestDistancesFrom(NetworkNode.room(candidateRoomId), baseGraph, candidateGraph);
        int unreachableCount = 0;
        int distanceSum = 0;
        int maxDistance = 0;
        for (Long connectedRoomId : connectedRoomIds) {
            Integer distance = distances.get(NetworkNode.room(connectedRoomId));
            if (distance == null) {
                unreachableCount++;
                continue;
            }
            distanceSum += distance;
            maxDistance = Math.max(maxDistance, distance);
        }
        return new CorridorStepScore(unreachableCount, distanceSum, maxDistance);
    }

    private static void addSegments(Map<NetworkNode, Set<NetworkNode>> graph, Collection<GridSegment> segments) {
        for (GridSegment segment : segments) {
            addGraphEdge(graph, NetworkNode.cell(segment.from()), NetworkNode.cell(segment.to()));
        }
    }

    private static void addDoors(Map<NetworkNode, Set<NetworkNode>> graph, Collection<DoorSegment> doors) {
        Map<UndirectedDoorKey, List<DoorSegment>> doorsByKey = new HashMap<>();
        for (DoorSegment door : doors) {
            doorsByKey.computeIfAbsent(UndirectedDoorKey.of(door), ignored -> new ArrayList<>()).add(door);
        }
        for (List<DoorSegment> groupedDoors : doorsByKey.values()) {
            if (groupedDoors.size() >= 2) {
                for (int index = 0; index < groupedDoors.size(); index++) {
                    for (int otherIndex = index + 1; otherIndex < groupedDoors.size(); otherIndex++) {
                        DoorSegment left = groupedDoors.get(index);
                        DoorSegment right = groupedDoors.get(otherIndex);
                        if (left.roomId() != right.roomId()) {
                            addGraphEdge(graph, NetworkNode.room(left.roomId()), NetworkNode.room(right.roomId()));
                        }
                    }
                }
                continue;
            }
            DoorSegment door = groupedDoors.getFirst();
            addGraphEdge(graph, NetworkNode.room(door.roomId()), NetworkNode.cell(DungeonCorridorGeometry.outsideCellForDoor(door)));
        }
    }

    private static void addGraphEdge(
            Map<NetworkNode, Set<NetworkNode>> graph,
            NetworkNode from,
            NetworkNode to
    ) {
        graph.computeIfAbsent(from, ignored -> new LinkedHashSet<>()).add(to);
        graph.computeIfAbsent(to, ignored -> new LinkedHashSet<>()).add(from);
    }

    private static Map<NetworkNode, Integer> shortestDistancesFrom(
            NetworkNode start,
            GraphSnapshot baseGraph,
            Map<NetworkNode, Set<NetworkNode>> candidateGraph
    ) {
        ArrayDeque<NetworkNode> queue = new ArrayDeque<>();
        Map<NetworkNode, Integer> distances = new HashMap<>();
        queue.add(start);
        distances.put(start, 0);
        while (!queue.isEmpty()) {
            NetworkNode current = queue.removeFirst();
            int currentDistance = distances.get(current);
            visitNeighbors(baseGraph.adjacency(), current, currentDistance, distances, queue);
            visitNeighbors(candidateGraph, current, currentDistance, distances, queue);
        }
        return distances;
    }

    private static void visitNeighbors(
            Map<NetworkNode, Set<NetworkNode>> graph,
            NetworkNode current,
            int currentDistance,
            Map<NetworkNode, Integer> distances,
            ArrayDeque<NetworkNode> queue
    ) {
        for (NetworkNode next : graph.getOrDefault(current, Set.of())) {
            if (distances.containsKey(next)) {
                continue;
            }
            distances.put(next, currentDistance + 1);
            queue.addLast(next);
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

    private record RoomNode(long roomId) implements NetworkNode {
    }

    private record CellNode(Point2i cell) implements NetworkNode {
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

    record GraphSnapshot(Map<NetworkNode, Set<NetworkNode>> adjacency) {
    }
}

record CorridorStepScore(
        int unreachableCount,
        int distanceSum,
        int maxDistance
) implements Comparable<CorridorStepScore> {
    @Override
    public int compareTo(CorridorStepScore other) {
        int unreachableComparison = Integer.compare(unreachableCount, other.unreachableCount);
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
