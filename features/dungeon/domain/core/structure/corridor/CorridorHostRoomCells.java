package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCellCoverage;

final class CorridorHostRoomCells {

    Map<Long, List<Cell>> roomCellsByRoom(DungeonMap dungeonMap) {
        RoomCellCoverage coverage = new RoomCellCoverage();
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (RoomCluster cluster : dungeonMap.topology().roomClusters()) {
            result.putAll(coverage.cellsByRoom(cluster, clusterRooms(dungeonMap, cluster.clusterId())));
        }
        return Map.copyOf(result);
    }

    Map<Long, RoomRegion> roomsById(DungeonMap dungeonMap) {
        Map<Long, RoomRegion> result = new LinkedHashMap<>();
        for (RoomRegion room : dungeonMap.rooms().rooms()) {
            if (room != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    Map<Long, RoomCluster> clustersById(DungeonMap dungeonMap) {
        Map<Long, RoomCluster> result = new LinkedHashMap<>();
        for (RoomCluster cluster : dungeonMap.topology().roomClusters()) {
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

    private static List<RoomRegion> clusterRooms(DungeonMap dungeonMap, long clusterId) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : dungeonMap.rooms().rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }
}
