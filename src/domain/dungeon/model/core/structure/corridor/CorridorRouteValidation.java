package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;

final class CorridorRouteValidation {
    private static final CorridorHostCellQuery HOST_CELL_QUERY = new CorridorHostCellQuery();

    RouteValidation validate(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end,
            CorridorHostCells hostCells
    ) {
        CorridorRoute route = route(dungeonMap, start, end, hostCells);
        return new RouteValidation(
                copiedCells(route.cells()),
                route.present() && !route.blockedBy(roomCells(dungeonMap)));
    }

    static Map<Long, List<Cell>> corridorCellsByCorridor(DungeonMap dungeonMap, List<Corridor> corridors) {
        return HOST_CELL_QUERY.cellsByCorridor(dungeonMap, corridors);
    }

    private static CorridorRoute route(
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

    private static @Nullable Cell corridorCell(
            DungeonMap dungeonMap,
            DungeonCorridorEndpoint endpoint,
            CorridorHostCells hostCells
    ) {
        if (endpoint.isDoorEndpoint()) {
            return endpoint.direction().neighborOf(endpoint.roomCell());
        }
        if (!endpoint.isAnchorEndpoint()) {
            return null;
        }
        Corridor host = CorridorMapLookup.corridor(dungeonMap, endpoint.hostCorridorId());
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

    record RouteValidation(List<Cell> routeCells, boolean hasValidRoute) {
        RouteValidation {
            routeCells = routeCells == null ? List.of() : List.copyOf(routeCells);
        }
    }
}
