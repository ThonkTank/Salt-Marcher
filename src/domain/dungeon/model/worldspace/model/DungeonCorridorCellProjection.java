package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonCorridorCellProjection {

    List<DungeonCell> corridorCells(
            DungeonCorridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
            Set<DungeonCell> roomCells
    ) {
        List<DungeonCell> backbone = corridor.bindings().waypoints().isEmpty()
                ? endpointCells(endpoints)
                : corridorWaypoints(corridor.bindings().waypoints(), clustersById);
        Set<DungeonCell> cells = new LinkedHashSet<>();
        addRouteCells(cells, backbone, roomCells);
        if (!backbone.isEmpty()) {
            for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint : endpoints) {
                addRouteCells(cells, List.of(endpoint.corridorCell(), nearestCell(endpoint.corridorCell(), backbone)), roomCells);
            }
        }
        if (cells.isEmpty()) {
            for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint : endpoints) {
                if (!roomCells.contains(endpoint.corridorCell())) {
                    cells.add(endpoint.corridorCell());
                }
            }
        }
        List<DungeonCell> result = new ArrayList<>(cells);
        result.sort(DungeonCorridorCellProjection::compareCells);
        return List.copyOf(result);
    }

    private static List<DungeonCell> endpointCells(List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint
                : endpoints == null ? List.<DungeonCorridorEndpointResolver.CorridorEndpoint>of() : endpoints) {
            if (endpoint != null) {
                result.add(endpoint.corridorCell());
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCell> corridorWaypoints(
            List<DungeonCorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCorridorWaypoint waypoint : waypoints) {
            DungeonRoomCluster cluster = clustersById.get(waypoint.clusterId());
            DungeonCell center = cluster == null
                    ? new DungeonCell(0, 0, waypoint.level())
                    : cluster.center();
            result.add(waypoint.absoluteCell(center));
        }
        return List.copyOf(result);
    }

    private static void addRouteCells(Set<DungeonCell> cells, List<DungeonCell> routeNodes, Set<DungeonCell> roomCells) {
        if (routeNodes == null || routeNodes.isEmpty()) {
            return;
        }
        if (routeNodes.size() == 1 && !roomCells.contains(routeNodes.getFirst())) {
            cells.add(routeNodes.getFirst());
            return;
        }
        for (int index = 1; index < routeNodes.size(); index++) {
            for (DungeonCell cell : manhattanPath(routeNodes.get(index - 1), routeNodes.get(index))) {
                if (!roomCells.contains(cell)) {
                    cells.add(cell);
                }
            }
        }
    }

    private static List<DungeonCell> manhattanPath(DungeonCell start, DungeonCell end) {
        if (start == null || end == null) {
            return List.of();
        }
        List<DungeonCell> result = new ArrayList<>();
        int q = start.q();
        int r = start.r();
        int level = start.level();
        result.add(new DungeonCell(q, r, level));
        while (q != end.q()) {
            q += Integer.compare(end.q(), q);
            result.add(new DungeonCell(q, r, level));
        }
        while (r != end.r()) {
            r += Integer.compare(end.r(), r);
            result.add(new DungeonCell(q, r, level));
        }
        if (level != end.level()) {
            result.add(new DungeonCell(end.q(), end.r(), end.level()));
        }
        return List.copyOf(result);
    }

    private static DungeonCell nearestCell(DungeonCell origin, List<DungeonCell> candidates) {
        DungeonCell result = origin;
        for (DungeonCell candidate : candidates == null ? List.<DungeonCell>of() : candidates) {
            if (candidate != null && betterCandidate(candidate, result, origin)) {
                result = candidate;
            }
        }
        return result;
    }

    private static int manhattan(DungeonCell left, DungeonCell right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.q() - right.q())
                + Math.abs(left.r() - right.r())
                + Math.abs(left.level() - right.level());
    }

    private static boolean betterCandidate(DungeonCell candidate, DungeonCell current, DungeonCell origin) {
        int distanceComparison = Integer.compare(manhattan(origin, candidate), manhattan(origin, current));
        if (distanceComparison != 0) {
            return distanceComparison < 0;
        }
        int levelComparison = Integer.compare(candidate.level(), current.level());
        if (levelComparison != 0) {
            return levelComparison < 0;
        }
        int rowComparison = Integer.compare(candidate.r(), current.r());
        if (rowComparison != 0) {
            return rowComparison < 0;
        }
        return candidate.q() < current.q();
    }

    private static int compareCells(DungeonCell left, DungeonCell right) {
        int levelComparison = Integer.compare(left.level(), right.level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rowComparison = Integer.compare(left.r(), right.r());
        if (rowComparison != 0) {
            return rowComparison;
        }
        return Integer.compare(left.q(), right.q());
    }
}
