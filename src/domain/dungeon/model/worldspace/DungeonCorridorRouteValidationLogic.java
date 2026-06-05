package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoute;

final class DungeonCorridorRouteValidationLogic {
    private static final DungeonCorridorHostCellsAdapter HOST_CELLS_ADAPTER = new DungeonCorridorHostCellsAdapter();
    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    CorridorRouteValidation validateRoute(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        CorridorRoute route = route(dungeonMap, start, end);
        return new CorridorRouteValidation(
                worldspaceCells(route.cells()),
                route.present() && !route.blockedBy(roomCells(dungeonMap)));
    }

    private CorridorRoute route(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (dungeonMap == null || start == null || end == null) {
            return new CorridorRoute(List.of());
        }
        DungeonCell startCell = corridorCell(dungeonMap, start);
        DungeonCell endCell = corridorCell(dungeonMap, end);
        if (startCell == null || endCell == null) {
            return new CorridorRoute(List.of());
        }
        return CorridorRoute.between(startCell.geometry(), endCell.geometry());
    }

    private DungeonCell corridorCell(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint) {
        if (endpoint.isDoorEndpoint()) {
            return endpoint.direction().neighborOf(endpoint.roomCell());
        }
        if (!endpoint.isAnchorEndpoint()) {
            return null;
        }
        DungeonCorridor host = LOOKUP_ADAPTER.corridor(dungeonMap, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        CorridorHostCells hostCells =
                HOST_CELLS_ADAPTER.hostCells(dungeonMap, dungeonMap.connections().corridors());
        return hostCells.cellsFor(host.corridorId()).isEmpty()
                ? null
                : DungeonCell.fromGeometry(hostCells.snapToHostCell(host.corridorId(), endpoint.anchorCell().geometry()));
    }

    private static Set<Cell> roomCells(DungeonMap dungeonMap) {
        DungeonRoomCellProjection projection = new DungeonRoomCellProjection();
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> clusterRooms = clusterRooms(dungeonMap, cluster.clusterId());
            for (List<DungeonCell> cells : projection.cellsByRoom(cluster, clusterRooms).values()) {
                result.addAll(coreCells(cells));
            }
        }
        return Set.copyOf(result);
    }

    private static List<DungeonRoom> clusterRooms(DungeonMap dungeonMap, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }

    private static List<DungeonCell> worldspaceCells(List<Cell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (Cell cell : cells) {
            result.add(DungeonCell.fromGeometry(cell));
        }
        return List.copyOf(result);
    }

    private static List<Cell> coreCells(List<DungeonCell> cells) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : cells) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }

    record CorridorRouteValidation(List<DungeonCell> routeCells, boolean hasValidRoute) {
        CorridorRouteValidation {
            routeCells = routeCells == null ? List.of() : List.copyOf(routeCells);
        }
    }
}
