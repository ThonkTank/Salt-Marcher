package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonCorridorCellProjection {
    private static final int SINGLE_ROUTE_TERMINUS_COUNT = 1;
    private static final int FULL_ROUTE_TERMINUS_COUNT = 2;

    List<DungeonCell> corridorCells(
            DungeonCorridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
            Set<DungeonCell> roomCells
    ) {
        boolean authoredBackbone = !corridor.bindings().waypoints().isEmpty();
        List<DungeonCell> backbone = !authoredBackbone
                ? endpointCells(endpoints)
                : authoredRouteCells(corridor.bindings().waypoints(), clustersById, endpoints);
        Set<DungeonCell> cells = new LinkedHashSet<>();
        addRouteCells(cells, backbone, roomCells, !authoredBackbone);
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

    private static List<DungeonCell> authoredRouteCells(
            List<DungeonCorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints
    ) {
        List<DungeonCell> waypointCells = corridorWaypoints(waypoints, clustersById);
        List<DungeonCorridorEndpointResolver.CorridorEndpoint> termini = routeTermini(endpoints);
        if (termini.isEmpty()) {
            return waypointCells;
        }
        List<DungeonCell> result = new ArrayList<>();
        result.add(termini.getFirst().corridorCell());
        result.addAll(waypointCells);
        if (termini.size() > SINGLE_ROUTE_TERMINUS_COUNT) {
            result.add(termini.getLast().corridorCell());
        }
        return List.copyOf(result);
    }

    private static List<DungeonCorridorEndpointResolver.CorridorEndpoint> routeTermini(
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints
    ) {
        List<DungeonCorridorEndpointResolver.CorridorEndpoint> doorEndpoints = new ArrayList<>();
        List<DungeonCorridorEndpointResolver.CorridorEndpoint> allEndpoints = new ArrayList<>();
        for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint
                : endpoints == null ? List.<DungeonCorridorEndpointResolver.CorridorEndpoint>of() : endpoints) {
            if (endpoint != null) {
                allEndpoints.add(endpoint);
                if (endpoint.isDoor()) {
                    doorEndpoints.add(endpoint);
                }
            }
        }
        if (doorEndpoints.size() >= FULL_ROUTE_TERMINUS_COUNT) {
            return List.of(doorEndpoints.getFirst(), doorEndpoints.getLast());
        }
        if (allEndpoints.size() <= FULL_ROUTE_TERMINUS_COUNT) {
            return List.copyOf(allEndpoints);
        }
        return List.of(allEndpoints.getFirst(), allEndpoints.getLast());
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

    private static void addRouteCells(
            Set<DungeonCell> cells,
            List<DungeonCell> routeNodes,
            Set<DungeonCell> roomCells,
            boolean filterRoomCells
    ) {
        if (routeNodes == null || routeNodes.isEmpty()) {
            return;
        }
        if (routeNodes.size() == 1 && !roomCells.contains(routeNodes.getFirst())) {
            cells.add(routeNodes.getFirst());
            return;
        }
        for (int index = 1; index < routeNodes.size(); index++) {
            for (DungeonCell cell : manhattanPath(routeNodes.get(index - 1), routeNodes.get(index))) {
                if (!filterRoomCells || !roomCells.contains(cell)) {
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
