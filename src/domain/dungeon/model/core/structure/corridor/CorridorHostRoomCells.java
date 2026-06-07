package src.domain.dungeon.model.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;

final class CorridorHostRoomCells {

    Map<Long, List<Cell>> roomCellsByRoom(DungeonMap dungeonMap) {
        RoomCellCoverage coverage = new RoomCellCoverage();
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            result.putAll(coverage.cellsByRoom(cluster, clusterRooms(dungeonMap, cluster.clusterId())));
        }
        return Map.copyOf(result);
    }

    Map<Long, DungeonRoom> roomsById(DungeonMap dungeonMap) {
        Map<Long, DungeonRoom> result = new LinkedHashMap<>();
        for (DungeonRoom room : dungeonMap.rooms().rooms()) {
            if (room != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    Map<Long, DungeonRoomCluster> clustersById(DungeonMap dungeonMap) {
        Map<Long, DungeonRoomCluster> result = new LinkedHashMap<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            if (cluster != null) {
                result.put(cluster.clusterId(), cluster);
            }
        }
        return Map.copyOf(result);
    }

    Set<Cell> allRoomCells(Map<Long, List<Cell>> roomCellsByRoom) {
        Set<Cell> result = new LinkedHashSet<>();
        for (List<Cell> cells : roomCellsByRoom.values()) {
            result.addAll(cells);
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
}
