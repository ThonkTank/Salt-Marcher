package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;

final class DungeonStairRoomCellProjection {
    private final DungeonRoomCellProjection roomCellProjection = new DungeonRoomCellProjection();

    Set<Cell> roomCells(SpatialTopology topology, RoomCatalog rooms) {
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            for (List<DungeonCell> cells : roomCellProjection.cellsByRoom(
                    cluster,
                    clusterRooms(rooms, cluster.clusterId())).values()) {
                for (DungeonCell cell : cells) {
                    result.add(cell.geometry());
                }
            }
        }
        return Set.copyOf(result);
    }

    private static List<DungeonRoom> clusterRooms(RoomCatalog rooms, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : rooms.rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }
}
