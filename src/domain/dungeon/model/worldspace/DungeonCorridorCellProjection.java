package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.component.CorridorWaypoint;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Route;

final class DungeonCorridorCellProjection {
    private static final int SINGLE_ROUTE_TERMINUS_COUNT = 1;
    private static final int FULL_ROUTE_TERMINUS_COUNT = 2;

    List<Cell> corridorCells(
            DungeonCorridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
            Set<Cell> roomCells
    ) {
        boolean authoredBackbone = !corridor.bindings().waypoints().isEmpty();
        List<Cell> backbone = !authoredBackbone
                ? endpointCells(endpoints)
                : authoredRouteCells(corridor.bindings().waypoints(), clustersById, endpoints);
        Set<Cell> cells = new LinkedHashSet<>();
        addRouteCells(cells, backbone, roomCells, !authoredBackbone);
        if (cells.isEmpty()) {
            for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint : endpoints) {
                if (!roomCells.contains(endpoint.corridorCell())) {
                    cells.add(endpoint.corridorCell());
                }
            }
        }
        List<Cell> result = new ArrayList<>(cells);
        result.sort(DungeonCorridorCellProjection::compareCells);
        return List.copyOf(result);
    }

    private static List<Cell> endpointCells(List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCorridorEndpointResolver.CorridorEndpoint endpoint
                : endpoints == null ? List.<DungeonCorridorEndpointResolver.CorridorEndpoint>of() : endpoints) {
            if (endpoint != null) {
                result.add(endpoint.corridorCell());
            }
        }
        return List.copyOf(result);
    }

    private static List<Cell> authoredRouteCells(
            List<CorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints
    ) {
        List<Cell> waypointCells = corridorWaypoints(waypoints, clustersById);
        List<DungeonCorridorEndpointResolver.CorridorEndpoint> termini = routeTermini(endpoints);
        if (termini.isEmpty()) {
            return waypointCells;
        }
        List<Cell> result = new ArrayList<>();
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

    private static List<Cell> corridorWaypoints(
            List<CorridorWaypoint> waypoints,
            Map<Long, DungeonRoomCluster> clustersById
    ) {
        List<Cell> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : waypoints) {
            DungeonRoomCluster cluster = clustersById.get(waypoint.clusterId());
            Cell center = cluster == null
                    ? new Cell(0, 0, waypoint.level())
                    : cluster.center();
            result.add(waypoint.absoluteCell(center));
        }
        return List.copyOf(result);
    }

    private static void addRouteCells(
            Set<Cell> cells,
            List<Cell> routeNodes,
            Set<Cell> roomCells,
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
            for (Cell cell : routeCells(routeNodes.get(index - 1), routeNodes.get(index))) {
                if (!filterRoomCells || !roomCells.contains(cell)) {
                    cells.add(cell);
                }
            }
        }
    }

    private static List<Cell> routeCells(Cell start, Cell end) {
        if (start == null || end == null) {
            return List.of();
        }
        return copiedCells(Route.horizontalFirst(start, end));
    }

    private static List<Cell> copiedCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells) {
            result.add(cell);
        }
        return List.copyOf(result);
    }

    private static int compareCells(Cell left, Cell right) {
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
