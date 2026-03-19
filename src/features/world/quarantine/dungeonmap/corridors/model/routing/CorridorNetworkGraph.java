package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.primitives.GridSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class CorridorNetworkGraph {

    private CorridorNetworkGraph() {
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

    static GraphSnapshot emptyGraphSnapshot() {
        return new GraphSnapshot(Map.of(), Map.of());
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

    private static <T> void addGraphEdge(Map<T, Set<T>> graph, T from, T to) {
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

    sealed interface NetworkNode permits RoomNode, CellNode {
        static NetworkNode room(long roomId) {
            return new RoomNode(roomId);
        }

        static NetworkNode cell(Point2i cell) {
            return new CellNode(cell);
        }
    }

    sealed interface CorridorNode permits CorridorCellNode, SharedDoorNode {
        static CorridorNode cell(Point2i cell) {
            return new CorridorCellNode(cell);
        }

        static CorridorNode sharedDoor(UndirectedDoorKey key) {
            return new SharedDoorNode(key);
        }
    }

    record RoomNode(long roomId) implements NetworkNode {
    }

    record CellNode(Point2i cell) implements NetworkNode {
    }

    record CorridorCellNode(Point2i cell) implements CorridorNode {
    }

    record SharedDoorNode(UndirectedDoorKey key) implements CorridorNode {
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
