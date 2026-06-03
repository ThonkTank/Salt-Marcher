package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Route;

final class DungeonCorridorRouteValidationLogic {
    private static final DungeonCorridorConnectionNormalizationLogic CONNECTION_NORMALIZATION_SERVICE =
            new DungeonCorridorConnectionNormalizationLogic();
    private static final DungeonMapLookupLogic LOOKUP_SERVICE = new DungeonMapLookupLogic();

    boolean hasValidRoute(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        List<DungeonCell> route = routeCells(dungeonMap, start, end);
        return !route.isEmpty() && !blocked(new LinkedHashSet<>(route), roomCells(dungeonMap));
    }

    List<DungeonCell> routeCells(DungeonMap dungeonMap, DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
        if (dungeonMap == null || start == null || end == null) {
            return List.of();
        }
        DungeonCell startCell = corridorCell(dungeonMap, start);
        DungeonCell endCell = corridorCell(dungeonMap, end);
        if (startCell == null || endCell == null) {
            return List.of();
        }
        return worldspaceCells(Route.horizontalFirstOnStartLevel(startCell.geometry(), endCell.geometry()));
    }

    private DungeonCell corridorCell(DungeonMap dungeonMap, DungeonCorridorEndpoint endpoint) {
        if (endpoint.isDoorEndpoint()) {
            return endpoint.direction().neighborOf(endpoint.roomCell());
        }
        if (!endpoint.isAnchorEndpoint()) {
            return null;
        }
        DungeonCorridor host = LOOKUP_SERVICE.corridor(dungeonMap, endpoint.hostCorridorId());
        if (host == null) {
            return null;
        }
        Map<Long, List<DungeonCell>> cellsByCorridor =
                CONNECTION_NORMALIZATION_SERVICE.corridorCellsByCorridor(dungeonMap, dungeonMap.connections().corridors());
        List<DungeonCell> hostCells = cellsByCorridor.getOrDefault(host.corridorId(), List.of());
        return hostCells.isEmpty()
                ? null
                : CONNECTION_NORMALIZATION_SERVICE.snapToHostCorridorCell(endpoint.anchorCell(), hostCells);
    }

    private static Set<DungeonCell> roomCells(DungeonMap dungeonMap) {
        DungeonRoomCellProjection projection = new DungeonRoomCellProjection();
        Set<DungeonCell> result = new LinkedHashSet<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> clusterRooms = clusterRooms(dungeonMap, cluster.clusterId());
            for (List<DungeonCell> cells : projection.cellsByRoom(cluster, clusterRooms).values()) {
                result.addAll(cells);
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

    private static boolean blocked(Set<DungeonCell> route, Set<DungeonCell> roomCells) {
        for (DungeonCell cell : route) {
            if (roomCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }
}
