package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.projection.DungeonAreaFacts;
import src.domain.dungeon.model.core.projection.DungeonCorridorProjection;
import src.domain.dungeon.model.core.structure.corridor.CorridorHostCells;

final class DungeonCorridorHostCellsAdapter {

    CorridorHostCells hostCells(DungeonMap dungeonMap, List<DungeonCorridor> corridors) {
        Map<Long, List<DungeonCell>> cellsByCorridor = corridorCellsByCorridor(dungeonMap, corridors);
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : cellsByCorridor.entrySet()) {
            result.put(entry.getKey(), coreCells(entry.getValue()));
        }
        return new CorridorHostCells(result);
    }

    private Map<Long, List<DungeonCell>> corridorCellsByCorridor(
            DungeonMap dungeonMap,
            List<DungeonCorridor> corridors
    ) {
        DungeonCorridorProjection projection = new DungeonCorridorReadProjection().project(
                corridors,
                clustersById(dungeonMap),
                roomsById(dungeonMap),
                roomCellsByRoom(dungeonMap),
                0L,
                Map.of());
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonAreaFacts area : projection.areas()) {
            if (area != null && area.isCorridor()) {
                result.put(area.id(), area.cells());
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, List<DungeonCell>> roomCellsByRoom(DungeonMap dungeonMap) {
        DungeonRoomCellProjection projector = new DungeonRoomCellProjection();
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> clusterRooms = new ArrayList<>();
            for (DungeonRoom room : dungeonMap.rooms().rooms()) {
                if (room != null && room.clusterId() == cluster.clusterId()) {
                    clusterRooms.add(room);
                }
            }
            result.putAll(projector.cellsByRoom(cluster, clusterRooms));
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoomCluster> clustersById(DungeonMap dungeonMap) {
        Map<Long, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            result.put(cluster.clusterId(), cluster);
        }
        return Map.copyOf(result);
    }

    private static Map<Long, DungeonRoom> roomsById(DungeonMap dungeonMap) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            result.put(room.roomId(), room);
        }
        return Map.copyOf(result);
    }

    private static List<Cell> coreCells(List<DungeonCell> cells) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }
}
