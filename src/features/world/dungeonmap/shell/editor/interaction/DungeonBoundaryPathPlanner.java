package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class DungeonBoundaryPathPlanner {

    PathResult findCreatePath(RoomCluster cluster, GridPoint2x start, GridPoint2x goal) {
        if (cluster == null || start == null || goal == null) {
            return PathResult.empty();
        }
        Set<GridSegment2x> traversableEdges = internalClusterEdges(cluster);
        Set<GridSegment2x> localConnectionEdges = localConnectionEdges(cluster, traversableEdges);
        List<GridSegment2x> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<GridSegment2x> committedEdges = new LinkedHashSet<>(route);
        committedEdges.removeAll(localConnectionEdges);
        Set<GridSegment2x> skippedConnectionEdges = new LinkedHashSet<>(route);
        skippedConnectionEdges.retainAll(localConnectionEdges);
        return new PathResult(route, committedEdges, skippedConnectionEdges);
    }

    PathResult findDeletePath(RoomCluster cluster, GridPoint2x start, GridPoint2x goal) {
        if (cluster == null || start == null || goal == null) {
            return PathResult.empty();
        }
        Set<GridSegment2x> traversableEdges = internalWallEdges(cluster);
        List<GridSegment2x> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        return new PathResult(route, new LinkedHashSet<>(route), Set.of());
    }

    Set<GridSegment2x> existingWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<GridSegment2x> edges = new LinkedHashSet<>(internalWallEdges(cluster));
        edges.addAll(outerWallEdges(cluster));
        return Set.copyOf(edges);
    }

    boolean touchesExistingWall(RoomCluster cluster, GridPoint2x vertex) {
        if (cluster == null || vertex == null) {
            return false;
        }
        for (GridSegment2x edge : existingWallEdges(cluster)) {
            if (edge.start().equals(vertex) || edge.end().equals(vertex)) {
                return true;
            }
        }
        return false;
    }

    boolean isEditableVertex(RoomCluster cluster, GridPoint2x vertex, boolean deleteMode) {
        if (cluster == null || vertex == null) {
            return false;
        }
        Set<GridSegment2x> edges = deleteMode ? internalWallEdges(cluster) : internalClusterEdges(cluster);
        return edges.stream().anyMatch(edge -> edge.start().equals(vertex) || edge.end().equals(vertex));
    }

    private static List<GridSegment2x> shortestPath(GridPoint2x start, GridPoint2x goal, Set<GridSegment2x> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<GridPoint2x, Set<GridPoint2x>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<GridPoint2x> queue = new ArrayDeque<>();
        Map<GridPoint2x, GridPoint2x> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            GridPoint2x current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (GridPoint2x neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(GridPoint2x.ORDER).toList()) {
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
        java.util.ArrayList<GridSegment2x> path = new java.util.ArrayList<>();
        GridPoint2x current = goal;
        while (!Objects.equals(current, start)) {
            GridPoint2x parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new GridSegment2x(parent, current));
            current = parent;
        }
        java.util.Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<GridPoint2x, Set<GridPoint2x>> adjacency(Collection<GridSegment2x> edges) {
        Map<GridPoint2x, Set<GridPoint2x>> result = new LinkedHashMap<>();
        for (GridSegment2x edge : edges == null ? List.<GridSegment2x>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<GridPoint2x, Set<GridPoint2x>> immutable = new LinkedHashMap<>();
        for (Map.Entry<GridPoint2x, Set<GridPoint2x>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static Set<GridSegment2x> internalClusterEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : cluster.cells()) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = cell.add(step);
                if (!cluster.contains(neighbor)) {
                    continue;
                }
                if (CellCoord.ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                CardinalDirection direction = CardinalDirection.fromDirection(step);
                if (direction != null) {
                    result.add(GridSegment2x.boundaryEdge(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Set<GridSegment2x> internalWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        return cluster.internalBoundaryKinds().entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.WALL)
                .map(Map.Entry::getKey)
                .filter(Objects::nonNull)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<GridSegment2x> outerWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<GridSegment2x> result = cluster.outerBoundarySegments2x().stream()
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        result.removeAll(localConnectionEdges(cluster, result));
        return Set.copyOf(result);
    }

    private static Set<GridSegment2x> localConnectionEdges(RoomCluster cluster, Set<GridSegment2x> allowedEdges) {
        if (cluster == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return Set.of();
        }
        return cluster.localConnections().stream()
                .filter(Objects::nonNull)
                .filter(connection -> connection.door() != null)
                .flatMap(connection -> connection.door().segments2x().stream())
                .filter(allowedEdges::contains)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    record PathResult(
            List<GridSegment2x> routeEdges,
            Set<GridSegment2x> committedEdges,
            Set<GridSegment2x> skippedConnectionEdges
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
