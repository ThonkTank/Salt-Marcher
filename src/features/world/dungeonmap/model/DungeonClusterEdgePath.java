package features.world.dungeonmap.model;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonClusterEdgePath {

    private DungeonClusterEdgePath() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonClusterEdgeRef> shortestInternalPath(
            long clusterId,
            Collection<Point2i> clusterCells,
            DungeonClusterVertexRef start,
            DungeonClusterVertexRef goal
    ) {
        return shortestInternalPath(clusterId, clusterCells, start, goal, null);
    }

    public static List<DungeonClusterEdgeRef> shortestInternalPath(
            long clusterId,
            Collection<Point2i> clusterCells,
            DungeonClusterVertexRef start,
            DungeonClusterVertexRef goal,
            Collection<DungeonClusterEdgeRef> allowedEdges
    ) {
        if (clusterCells == null || start == null || goal == null || start.point() == null || goal.point() == null) {
            return List.of();
        }
        if (!start.point().equals(goal.point()) && start.clusterId() != goal.clusterId()) {
            return List.of();
        }
        if (start.point().equals(goal.point())) {
            return List.of();
        }
        Set<Point2i> normalizedCells = Set.copyOf(clusterCells);
        Map<EdgeKey, EdgeNode> nodesByKey = buildInternalEdgeGraph(clusterId, normalizedCells, allowedEdges);
        if (nodesByKey.isEmpty()) {
            return List.of();
        }
        Set<EdgeKey> startKeys = frontierFor(nodesByKey, start.point());
        Set<EdgeKey> goalKeys = frontierFor(nodesByKey, goal.point());
        if (startKeys.isEmpty() || goalKeys.isEmpty()) {
            return List.of();
        }
        List<EdgeKey> orderedStarts = startKeys.stream().sorted().toList();
        Set<EdgeKey> goalSet = Set.copyOf(goalKeys);
        ArrayDeque<EdgeKey> queue = new ArrayDeque<>(orderedStarts);
        Map<EdgeKey, EdgeKey> previous = new HashMap<>();
        Set<EdgeKey> visited = new LinkedHashSet<>(orderedStarts);
        EdgeKey resolvedGoal = null;
        while (!queue.isEmpty()) {
            EdgeKey current = queue.removeFirst();
            if (goalSet.contains(current)) {
                resolvedGoal = current;
                break;
            }
            for (EdgeKey neighbor : nodesByKey.get(current).neighbors()) {
                if (visited.add(neighbor)) {
                    previous.put(neighbor, current);
                    queue.addLast(neighbor);
                }
            }
        }
        if (resolvedGoal == null) {
            return List.of();
        }
        List<DungeonClusterEdgeRef> path = new ArrayList<>();
        for (EdgeKey cursor = resolvedGoal; cursor != null; cursor = previous.get(cursor)) {
            path.add(nodesByKey.get(cursor).edgeRef());
        }
        java.util.Collections.reverse(path);
        return List.copyOf(path);
    }

    public static boolean isPathVertex(
            long clusterId,
            Collection<Point2i> clusterCells,
            DungeonClusterVertexRef vertex
    ) {
        return isPathVertex(clusterId, clusterCells, vertex, null);
    }

    public static boolean isPathVertex(
            long clusterId,
            Collection<Point2i> clusterCells,
            DungeonClusterVertexRef vertex,
            Collection<DungeonClusterEdgeRef> allowedEdges
    ) {
        if (clusterCells == null || vertex == null || vertex.point() == null || vertex.clusterId() != clusterId) {
            return false;
        }
        Map<EdgeKey, EdgeNode> nodesByKey = buildInternalEdgeGraph(clusterId, Set.copyOf(clusterCells), allowedEdges);
        return !frontierFor(nodesByKey, vertex.point()).isEmpty();
    }

    private static Map<EdgeKey, EdgeNode> buildInternalEdgeGraph(long clusterId, Set<Point2i> clusterCells) {
        return buildInternalEdgeGraph(clusterId, clusterCells, null);
    }

    private static Map<EdgeKey, EdgeNode> buildInternalEdgeGraph(
            long clusterId,
            Set<Point2i> clusterCells,
            Collection<DungeonClusterEdgeRef> allowedEdges
    ) {
        Set<EdgeKey> allowedKeys = allowedEdgeKeys(clusterId, allowedEdges);
        Map<EdgeKey, EdgeNodeBuilder> builders = new LinkedHashMap<>();
        for (Point2i cell : clusterCells) {
            for (DungeonRoomCluster.EdgeDirection direction : DungeonRoomCluster.EdgeDirection.values()) {
                DungeonClusterEdgeRef rawRef = new DungeonClusterEdgeRef(clusterId, cell, direction);
                if (!isInternalEdge(clusterCells, rawRef)) {
                    continue;
                }
                DungeonClusterEdgeRef canonicalRef = canonicalRef(clusterId, rawRef);
                EdgeKey key = EdgeKey.of(canonicalRef);
                if (allowedKeys != null && !allowedKeys.contains(key)) {
                    continue;
                }
                builders.computeIfAbsent(key, ignored -> new EdgeNodeBuilder(canonicalRef));
            }
        }
        List<EdgeKey> sortedKeys = builders.keySet().stream().sorted().toList();
        for (int index = 0; index < sortedKeys.size(); index++) {
            EdgeKey left = sortedKeys.get(index);
            for (int otherIndex = index + 1; otherIndex < sortedKeys.size(); otherIndex++) {
                EdgeKey right = sortedKeys.get(otherIndex);
                if (!sharesVertex(left, right)) {
                    continue;
                }
                builders.get(left).neighbors().add(right);
                builders.get(right).neighbors().add(left);
            }
        }
        Map<EdgeKey, EdgeNode> result = new LinkedHashMap<>();
        for (EdgeKey key : sortedKeys) {
            EdgeNodeBuilder builder = builders.get(key);
            List<EdgeKey> neighbors = builder.neighbors().stream().sorted().toList();
            result.put(key, new EdgeNode(builder.edgeRef(), neighbors));
        }
        return result;
    }

    private static Set<EdgeKey> allowedEdgeKeys(long clusterId, Collection<DungeonClusterEdgeRef> allowedEdges) {
        if (allowedEdges == null) {
            return null;
        }
        Set<EdgeKey> allowedKeys = new LinkedHashSet<>();
        for (DungeonClusterEdgeRef edgeRef : allowedEdges) {
            if (edgeRef == null || edgeRef.clusterId() != clusterId) {
                continue;
            }
            allowedKeys.add(EdgeKey.of(canonicalRef(clusterId, edgeRef)));
        }
        return Set.copyOf(allowedKeys);
    }

    private static Set<EdgeKey> frontierFor(
            Map<EdgeKey, EdgeNode> nodesByKey,
            Point2i vertex
    ) {
        if (vertex == null || nodesByKey == null || nodesByKey.isEmpty()) {
            return Set.of();
        }
        Set<EdgeKey> frontier = new LinkedHashSet<>();
        for (EdgeNode node : nodesByKey.values()) {
            EdgeVertices candidate = edgeVertices(node.edgeRef());
            if (candidate != null && (candidate.start().equals(vertex) || candidate.end().equals(vertex))) {
                frontier.add(EdgeKey.of(node.edgeRef()));
            }
        }
        return Set.copyOf(frontier);
    }

    private static DungeonClusterEdgeRef canonicalRef(long clusterId, DungeonClusterEdgeRef edgeRef) {
        DungeonRoomCluster.EdgeOverride canonical = DungeonRoomCluster.EdgeOverride.of(
                edgeRef.cell(),
                edgeRef.direction(),
                DungeonRoomCluster.EdgeType.WALL);
        return new DungeonClusterEdgeRef(clusterId, canonical.cell(), canonical.direction());
    }

    private static boolean sharesVertex(EdgeKey left, EdgeKey right) {
        return left.start().equals(right.start())
                || left.start().equals(right.end())
                || left.end().equals(right.start())
                || left.end().equals(right.end());
    }

    private static boolean isInternalEdge(Collection<Point2i> clusterCells, DungeonClusterEdgeRef edgeRef) {
        if (edgeRef == null || edgeRef.cell() == null || edgeRef.direction() == null || clusterCells == null) {
            return false;
        }
        Point2i neighbor = edgeRef.cell().add(edgeRef.direction().delta());
        return clusterCells.contains(edgeRef.cell()) && clusterCells.contains(neighbor);
    }

    private static EdgeVertices edgeVertices(DungeonClusterEdgeRef edgeRef) {
        if (edgeRef == null || edgeRef.cell() == null || edgeRef.direction() == null) {
            return null;
        }
        Point2i cell = edgeRef.cell();
        return switch (edgeRef.direction()) {
            case NORTH -> new EdgeVertices(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()));
            case EAST -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1));
            case SOUTH -> new EdgeVertices(new Point2i(cell.x() + 1, cell.y() + 1), new Point2i(cell.x(), cell.y() + 1));
            case WEST -> new EdgeVertices(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x(), cell.y()));
        };
    }

    private record EdgeVertices(Point2i start, Point2i end) {
        public boolean sharesVertexWith(EdgeVertices other) {
            return other != null
                    && (start.equals(other.start)
                    || start.equals(other.end)
                    || end.equals(other.start)
                    || end.equals(other.end));
        }
    }

    private record EdgeNode(DungeonClusterEdgeRef edgeRef, List<EdgeKey> neighbors) {
    }

    private record EdgeNodeBuilder(DungeonClusterEdgeRef edgeRef, Set<EdgeKey> neighbors) {
        private EdgeNodeBuilder(DungeonClusterEdgeRef edgeRef) {
            this(edgeRef, new LinkedHashSet<>());
        }
    }

    private record EdgeKey(Point2i start, Point2i end) implements Comparable<EdgeKey> {
        private static EdgeKey of(DungeonClusterEdgeRef edgeRef) {
            EdgeVertices vertices = edgeVertices(edgeRef);
            if (vertices == null) {
                throw new IllegalArgumentException("Ungueltige Clusterkante");
            }
            return of(vertices.start(), vertices.end());
        }

        private static EdgeKey of(Point2i first, Point2i second) {
            if (comparePoint(first, second) <= 0) {
                return new EdgeKey(first, second);
            }
            return new EdgeKey(second, first);
        }

        @Override
        public int compareTo(EdgeKey other) {
            int startCompare = comparePoint(start, other.start);
            if (startCompare != 0) {
                return startCompare;
            }
            return comparePoint(end, other.end);
        }

        private static int comparePoint(Point2i left, Point2i right) {
            return Comparator.comparingInt(Point2i::y)
                    .thenComparingInt(Point2i::x)
                    .compare(left, right);
        }
    }
}
