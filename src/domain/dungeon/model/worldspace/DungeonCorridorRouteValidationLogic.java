package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapLookupAdapter;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;
import src.domain.dungeon.model.core.structure.corridor.CorridorRoute;
import src.domain.dungeon.model.core.structure.corridor.DungeonCorridorEndpoint;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;

final class DungeonCorridorRouteValidationLogic {
    private static final DungeonMapLookupAdapter LOOKUP_ADAPTER = new DungeonMapLookupAdapter();

    CorridorRouteValidation validateRoute(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end,
            CorridorHostCells hostCells
    ) {
        CorridorRoute route = route(dungeonMap, start, end, hostCells);
        return new CorridorRouteValidation(
                copiedCells(route.cells()),
                route.present() && !route.blockedBy(roomCells(dungeonMap)));
    }

    private CorridorRoute route(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end,
            CorridorHostCells hostCells
    ) {
        if (dungeonMap == null || start == null || end == null) {
            return new CorridorRoute(List.of());
        }
        Cell startCell = corridorCell(dungeonMap, start, hostCells);
        Cell endCell = corridorCell(dungeonMap, end, hostCells);
        if (startCell == null || endCell == null) {
            return new CorridorRoute(List.of());
        }
        return CorridorRoute.between(startCell, endCell);
    }

    private Cell corridorCell(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint, CorridorHostCells hostCells) {
        if (endpoint.isDoorEndpoint()) {
            return endpoint.direction().neighborOf(endpoint.roomCell());
        }
        if (!endpoint.isAnchorEndpoint()) {
            return null;
        }
        Corridor host = LOOKUP_ADAPTER.corridor(dungeonMap, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        return hostCells.cellsFor(host.corridorId()).isEmpty()
                ? null
                : hostCells.snapToHostCell(host.corridorId(), endpoint.anchorCell());
    }

    private static Set<Cell> roomCells(DungeonMap dungeonMap) {
        RoomCellCoverage coverage = new RoomCellCoverage();
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> clusterRooms = clusterRooms(dungeonMap, cluster.clusterId());
            for (List<Cell> cells : coverage.cellsByRoom(cluster, clusterRooms).values()) {
                result.addAll(nonNullCells(cells));
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

    private static List<Cell> copiedCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells) {
            result.add(cell);
        }
        return List.copyOf(result);
    }

    private static List<Cell> nonNullCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    record CorridorRouteValidation(List<Cell> routeCells, boolean hasValidRoute) {
        CorridorRouteValidation {
            routeCells = routeCells == null ? List.of() : List.copyOf(routeCells);
        }
    }
}
