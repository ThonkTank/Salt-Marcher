package features.dungeon.domain.core.projection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorRoute;
import features.dungeon.domain.core.structure.room.DungeonRoomCluster;

/**
 * Projection boundary for authored corridor route facts supplied by core
 * structure owners.
 */
final class DungeonCorridorCellProjection {
    private static final int SINGLE_ROUTE_TERMINUS_COUNT = 1;
    private static final int FULL_ROUTE_TERMINUS_COUNT = 2;

    List<Cell> corridorCells(
            Corridor corridor,
            Map<Long, DungeonRoomCluster> clustersById,
            List<DungeonCorridorEndpointResolver.CorridorEndpoint> endpoints,
            Set<Cell> roomCells
    ) {
        boolean authoredBackbone = !corridor.stateBindings().waypoints().isEmpty();
        List<Cell> backbone = !authoredBackbone
                ? endpointCells(endpoints)
                : authoredRouteCells(corridor.stateBindings().waypoints(), clustersById, endpoints);
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
            for (Cell cell : routeCells(routeNodes.get(index - 1), routeNodes.get(index), roomCells)) {
                if (!filterRoomCells || !roomCells.contains(cell)) {
                    cells.add(cell);
                }
            }
        }
    }

    private static List<Cell> routeCells(Cell start, Cell end, Set<Cell> roomCells) {
        if (start == null || end == null) {
            return List.of();
        }
        Set<Cell> blockedCells = roomCells == null ? Set.of() : roomCells;
        return CorridorRoute.unblockedBetweenWithLevelTransition(start, end, blockedCells).cells();
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
