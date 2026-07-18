package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.RoomCluster;

final class CorridorHostCellDerivation {
    private static final CorridorRoutingPolicy ROUTING_POLICY = new OrthogonalCorridorRoutingPolicy();
    private static final int SINGLE_ROUTE_TERMINUS_COUNT = 1;
    private static final CorridorHostBackboneCells BACKBONE_CELLS = new CorridorHostBackboneCells();
    private static final int FULL_ROUTE_TERMINUS_COUNT = 2;

    List<Cell> corridorCells(
            Corridor corridor,
            Map<Long, RoomCluster> clustersById,
            List<CorridorHostEndpoint> endpoints,
            Set<Cell> roomCells
    ) {
        boolean authoredBackbone = !corridor.bindings().waypoints().isEmpty();
        List<Cell> backbone = authoredBackbone
                ? BACKBONE_CELLS.authoredBackbone(corridor.bindings().waypoints(), clustersById, endpoints)
                : BACKBONE_CELLS.endpointBackbone(endpoints);
        Set<Cell> cells = new LinkedHashSet<>();
        addRouteCells(cells, backbone, roomCells, !authoredBackbone);
        if (cells.isEmpty()) {
            for (CorridorHostEndpoint endpoint : endpoints) {
                if (!roomCells.contains(endpoint.corridorCell())) {
                    cells.add(endpoint.corridorCell());
                }
            }
        }
        List<Cell> result = new ArrayList<>(cells);
        result.sort(CorridorHostCellDerivation::compareCells);
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
        if (routeNodes.size() == SINGLE_ROUTE_TERMINUS_COUNT && !roomCells.contains(routeNodes.getFirst())) {
            cells.add(routeNodes.getFirst());
            return;
        }
        addRouteSegments(cells, routeNodes, roomCells, filterRoomCells);
    }

    private static void addRouteSegments(
            Set<Cell> cells,
            List<Cell> routeNodes,
            Set<Cell> roomCells,
            boolean filterRoomCells
    ) {
        for (int index = SINGLE_ROUTE_TERMINUS_COUNT; index < routeNodes.size(); index++) {
            for (Cell cell : segmentCells(routeNodes, index, roomCells)) {
                addIfKept(cells, cell, roomCells, filterRoomCells);
            }
        }
    }

    private static List<Cell> segmentCells(List<Cell> routeNodes, int index, Set<Cell> roomCells) {
        Cell previous = routeNodes.get(index - SINGLE_ROUTE_TERMINUS_COUNT);
        Cell current = routeNodes.get(index);
        return previous == null || current == null
                ? List.of()
                : ROUTING_POLICY.routeWithLevelTransition(previous, current, roomCells).cells();
    }

    private static void addIfKept(
            Set<Cell> cells,
            Cell cell,
            Set<Cell> roomCells,
            boolean filterRoomCells
    ) {
        if (keptRouteCell(cell, roomCells, filterRoomCells)) {
            cells.add(cell);
        }
    }

    private static boolean keptRouteCell(Cell cell, Set<Cell> roomCells, boolean filterRoomCells) {
        return !filterRoomCells || !roomCells.contains(cell);
    }

    private static int compareCells(Cell left, Cell right) {
        return Comparator.comparingInt(Cell::level)
                .thenComparingInt(Cell::r)
                .thenComparingInt(Cell::q)
                .compare(left, right);
    }
}
