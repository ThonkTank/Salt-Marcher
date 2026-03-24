package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class DungeonBoundaryPathPlanner {

    PathResult findCreatePath(RoomCluster cluster, Point2i start, Point2i goal) {
        if (cluster == null || start == null || goal == null) {
            return PathResult.empty();
        }
        Set<VertexEdge> traversableEdges = internalClusterEdges(cluster);
        Set<VertexEdge> localConnectionEdges = localConnectionEdges(cluster, traversableEdges);
        List<VertexEdge> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<VertexEdge> committedEdges = new LinkedHashSet<>(route);
        committedEdges.removeAll(localConnectionEdges);
        Set<VertexEdge> skippedConnectionEdges = new LinkedHashSet<>(route);
        skippedConnectionEdges.retainAll(localConnectionEdges);
        return new PathResult(route, committedEdges, skippedConnectionEdges);
    }

    PathResult findDeletePath(RoomCluster cluster, Point2i start, Point2i goal) {
        if (cluster == null || start == null || goal == null) {
            return PathResult.empty();
        }
        Set<VertexEdge> traversableEdges = internalWallEdges(cluster);
        List<VertexEdge> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        return new PathResult(route, new LinkedHashSet<>(route), Set.of());
    }

    Set<VertexEdge> existingWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<VertexEdge> edges = new LinkedHashSet<>(internalWallEdges(cluster));
        edges.addAll(outerWallEdges(cluster));
        return Set.copyOf(edges);
    }

    boolean touchesExistingWall(RoomCluster cluster, Point2i vertex) {
        if (cluster == null || vertex == null) {
            return false;
        }
        for (VertexEdge edge : existingWallEdges(cluster)) {
            if (edge.touches(vertex)) {
                return true;
            }
        }
        return false;
    }

    boolean isEditableVertex(RoomCluster cluster, Point2i vertex, boolean deleteMode) {
        if (cluster == null || vertex == null) {
            return false;
        }
        Set<VertexEdge> edges = deleteMode ? internalWallEdges(cluster) : internalClusterEdges(cluster);
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }

    private static List<VertexEdge> shortestPath(Point2i start, Point2i goal, Set<VertexEdge> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<Point2i, Set<Point2i>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<Point2i> queue = new ArrayDeque<>();
        Map<Point2i, Point2i> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            Point2i current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (Point2i neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(Point2i.POINT_ORDER).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
        java.util.ArrayList<VertexEdge> path = new java.util.ArrayList<>();
        Point2i current = goal;
        while (!Objects.equals(current, start)) {
            Point2i parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new VertexEdge(parent, current));
            current = parent;
        }
        java.util.Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<Point2i, Set<Point2i>> adjacency(Collection<VertexEdge> edges) {
        Map<Point2i, Set<Point2i>> result = new LinkedHashMap<>();
        for (VertexEdge edge : edges == null ? List.<VertexEdge>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<Point2i, Set<Point2i>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Point2i, Set<Point2i>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static Set<VertexEdge> internalClusterEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<VertexEdge> result = new LinkedHashSet<>();
        for (Point2i cell : cluster.cells()) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = cell.add(step);
                if (!cluster.contains(neighbor)) {
                    continue;
                }
                if (Point2i.POINT_ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                result.add(VertexEdge.betweenCellAndStep(cell, step));
            }
        }
        return Set.copyOf(result);
    }

    private static Set<VertexEdge> internalWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        return cluster.internalBoundaryKinds().entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.WALL)
                .map(Map.Entry::getKey)
                .filter(Objects::nonNull)
                .sorted(VertexEdge.EDGE_ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<VertexEdge> outerWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<VertexEdge> result = new LinkedHashSet<>(cluster.shape().boundaryEdges());
        result.removeAll(localConnectionEdges(cluster, result));
        return Set.copyOf(result);
    }

    private static Set<VertexEdge> localConnectionEdges(RoomCluster cluster, Set<VertexEdge> allowedEdges) {
        if (cluster == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return Set.of();
        }
        return cluster.localConnections().stream()
                .filter(Objects::nonNull)
                .filter(connection -> connection.door() != null)
                .flatMap(connection -> connection.door().edges().stream())
                .filter(allowedEdges::contains)
                .sorted(VertexEdge.EDGE_ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    record PathResult(
            List<VertexEdge> routeEdges,
            Set<VertexEdge> committedEdges,
            Set<VertexEdge> skippedConnectionEdges
    ) {
        PathResult {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
            skippedConnectionEdges = skippedConnectionEdges == null ? Set.of() : Set.copyOf(skippedConnectionEdges);
        }

        static PathResult empty() {
            return new PathResult(List.of(), Set.of(), Set.of());
        }

        boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }
}
