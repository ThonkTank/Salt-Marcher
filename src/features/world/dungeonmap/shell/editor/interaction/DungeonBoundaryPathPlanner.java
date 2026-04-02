package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
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

    PathResult findCreatePath(RoomCluster cluster, LegacyGridPoint2x start, LegacyGridPoint2x goal) {
        if (cluster == null || start == null || goal == null) {
            return PathResult.empty();
        }
        Set<LegacyGridSegment2x> traversableEdges = internalClusterEdges(cluster);
        Set<LegacyGridSegment2x> localConnectionEdges = localConnectionEdges(cluster, traversableEdges);
        List<LegacyGridSegment2x> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<LegacyGridSegment2x> committedEdges = new LinkedHashSet<>(route);
        committedEdges.removeAll(localConnectionEdges);
        Set<LegacyGridSegment2x> skippedConnectionEdges = new LinkedHashSet<>(route);
        skippedConnectionEdges.retainAll(localConnectionEdges);
        return new PathResult(route, committedEdges, skippedConnectionEdges);
    }

    PathResult findDeletePath(RoomCluster cluster, LegacyGridPoint2x start, LegacyGridPoint2x goal) {
        if (cluster == null || start == null || goal == null) {
            return PathResult.empty();
        }
        Set<LegacyGridSegment2x> traversableEdges = internalWallEdges(cluster);
        List<LegacyGridSegment2x> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        return new PathResult(route, new LinkedHashSet<>(route), Set.of());
    }

    Set<LegacyGridSegment2x> existingWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<LegacyGridSegment2x> edges = new LinkedHashSet<>(internalWallEdges(cluster));
        edges.addAll(outerWallEdges(cluster));
        return Set.copyOf(edges);
    }

    boolean touchesExistingWall(RoomCluster cluster, LegacyGridPoint2x vertex) {
        if (cluster == null || vertex == null) {
            return false;
        }
        for (LegacyGridSegment2x edge : existingWallEdges(cluster)) {
            if (edge.touches(vertex)) {
                return true;
            }
        }
        return false;
    }

    boolean isEditableVertex(RoomCluster cluster, LegacyGridPoint2x vertex, boolean deleteMode) {
        if (cluster == null || vertex == null) {
            return false;
        }
        Set<LegacyGridSegment2x> edges = deleteMode ? internalWallEdges(cluster) : internalClusterEdges(cluster);
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }

    private static List<LegacyGridSegment2x> shortestPath(LegacyGridPoint2x start, LegacyGridPoint2x goal, Set<LegacyGridSegment2x> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<LegacyGridPoint2x, Set<LegacyGridPoint2x>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<LegacyGridPoint2x> queue = new ArrayDeque<>();
        Map<LegacyGridPoint2x, LegacyGridPoint2x> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            LegacyGridPoint2x current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (LegacyGridPoint2x neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(LegacyGridPoint2x.POINT_ORDER).toList()) {
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
        java.util.ArrayList<LegacyGridSegment2x> path = new java.util.ArrayList<>();
        LegacyGridPoint2x current = goal;
        while (!Objects.equals(current, start)) {
            LegacyGridPoint2x parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new LegacyGridSegment2x(parent, current));
            current = parent;
        }
        java.util.Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<LegacyGridPoint2x, Set<LegacyGridPoint2x>> adjacency(Collection<LegacyGridSegment2x> edges) {
        Map<LegacyGridPoint2x, Set<LegacyGridPoint2x>> result = new LinkedHashMap<>();
        for (LegacyGridSegment2x edge : edges == null ? List.<LegacyGridSegment2x>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<LegacyGridPoint2x, Set<LegacyGridPoint2x>> immutable = new LinkedHashMap<>();
        for (Map.Entry<LegacyGridPoint2x, Set<LegacyGridPoint2x>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static Set<LegacyGridSegment2x> internalClusterEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<LegacyGridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : cluster.cells()) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = cell.add(step);
                if (!cluster.contains(neighbor)) {
                    continue;
                }
                if (CellCoord.ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                result.add(LegacyGridSegment2x.betweenCellAndStep(cell, step));
            }
        }
        return Set.copyOf(result);
    }

    private static Set<LegacyGridSegment2x> internalWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        return GridSegment2x.toLegacyBoundaryEdges(cluster.internalBoundaryKinds().entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.WALL)
                .map(Map.Entry::getKey)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new))).stream()
                .sorted(LegacyGridSegment2x.SEGMENT_ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<LegacyGridSegment2x> outerWallEdges(RoomCluster cluster) {
        if (cluster == null) {
            return Set.of();
        }
        Set<LegacyGridSegment2x> result = GridSegment2x.toLegacyBoundaryEdges(cluster.outerBoundarySegments2x()).stream()
                .sorted(LegacyGridSegment2x.SEGMENT_ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        result.removeAll(localConnectionEdges(cluster, result));
        return Set.copyOf(result);
    }

    private static Set<LegacyGridSegment2x> localConnectionEdges(RoomCluster cluster, Set<LegacyGridSegment2x> allowedEdges) {
        if (cluster == null || allowedEdges == null || allowedEdges.isEmpty()) {
            return Set.of();
        }
        return cluster.localConnections().stream()
                .filter(Objects::nonNull)
                .filter(connection -> connection.door() != null)
                .flatMap(connection -> connection.door().segments2x().stream())
                .filter(allowedEdges::contains)
                .sorted(LegacyGridSegment2x.SEGMENT_ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    record PathResult(
            List<LegacyGridSegment2x> routeEdges,
            Set<LegacyGridSegment2x> committedEdges,
            Set<LegacyGridSegment2x> skippedConnectionEdges
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
