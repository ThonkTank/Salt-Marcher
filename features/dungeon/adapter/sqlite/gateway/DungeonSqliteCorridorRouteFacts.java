package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Shared canonical corridor geometry used by persisted spatial membership and sparse windows. */
final class DungeonSqliteCorridorRouteFacts {

    private static final CorridorRoutingPolicy ROUTING = new OrthogonalCorridorRoutingPolicy();
    private static final int COMPLETE_TERMINUS_COUNT = 2;

    private DungeonSqliteCorridorRouteFacts() {
    }

    static List<RouteCell> routeCells(
            List<Cell> waypoints,
            List<Cell> doorEndpoints,
            List<Cell> anchorEndpoints,
            Set<Cell> roomCells
    ) {
        List<Cell> safeWaypoints = copyCells(waypoints);
        List<Cell> safeDoorEndpoints = copyCells(doorEndpoints);
        List<Cell> endpoints = new ArrayList<>(safeDoorEndpoints);
        endpoints.addAll(copyCells(anchorEndpoints));
        boolean authoredBackbone = !safeWaypoints.isEmpty();
        List<Cell> nodes = authoredBackbone
                ? authoredRouteNodes(safeWaypoints, routeTermini(safeDoorEndpoints, endpoints))
                : List.copyOf(endpoints);
        Set<Cell> blocked = roomCells == null ? Set.of() : Set.copyOf(roomCells);
        List<RouteCell> result = new ArrayList<>();
        Set<Cell> seen = new LinkedHashSet<>();
        if (nodes.size() == 1 && !blocked.contains(nodes.getFirst())) {
            append(result, seen, 0, 0, nodes.getFirst(), authoredBackbone, blocked);
        }
        for (int segment = 1; segment < nodes.size(); segment++) {
            List<Cell> cells = ROUTING.routeWithLevelTransition(
                    nodes.get(segment - 1), nodes.get(segment), blocked).cells();
            for (int cellOrder = 0; cellOrder < cells.size(); cellOrder++) {
                append(result, seen, segment - 1, cellOrder, cells.get(cellOrder), authoredBackbone, blocked);
            }
        }
        if (result.isEmpty()) {
            for (int endpointOrder = 0; endpointOrder < endpoints.size(); endpointOrder++) {
                Cell endpoint = endpoints.get(endpointOrder);
                if (!blocked.contains(endpoint) && seen.add(endpoint)) {
                    result.add(new RouteCell(endpointOrder, 0, endpoint));
                }
            }
        }
        return List.copyOf(result);
    }

    private static void append(
            List<RouteCell> result,
            Set<Cell> seen,
            int segmentOrder,
            int cellOrder,
            Cell cell,
            boolean authoredBackbone,
            Set<Cell> roomCells
    ) {
        if ((authoredBackbone || !roomCells.contains(cell)) && seen.add(cell)) {
            result.add(new RouteCell(segmentOrder, cellOrder, cell));
        }
    }

    private static List<Cell> authoredRouteNodes(List<Cell> waypoints, List<Cell> termini) {
        List<Cell> result = new ArrayList<>();
        if (!termini.isEmpty()) {
            result.add(termini.getFirst());
        }
        result.addAll(waypoints);
        if (termini.size() > 1) {
            result.add(termini.getLast());
        }
        return List.copyOf(result);
    }

    private static List<Cell> routeTermini(List<Cell> doorEndpoints, List<Cell> endpoints) {
        if (doorEndpoints.size() >= COMPLETE_TERMINUS_COUNT) {
            return List.of(doorEndpoints.getFirst(), doorEndpoints.getLast());
        }
        if (endpoints.size() <= COMPLETE_TERMINUS_COUNT) {
            return List.copyOf(endpoints);
        }
        return List.of(endpoints.getFirst(), endpoints.getLast());
    }

    private static List<Cell> copyCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    record RouteCell(int segmentOrder, int cellOrder, Cell cell) {
        RouteCell {
            if (cell == null) {
                throw new IllegalArgumentException("corridor route cell must be present");
            }
        }
    }
}
