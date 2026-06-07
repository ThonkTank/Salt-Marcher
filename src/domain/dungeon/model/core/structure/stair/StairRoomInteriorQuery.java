package src.domain.dungeon.model.core.structure.stair;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.DungeonRoom;
import src.domain.dungeon.model.core.structure.room.DungeonRoomCluster;
import src.domain.dungeon.model.core.structure.room.RoomCatalog;
import src.domain.dungeon.model.core.structure.room.RoomCellCoverage;
import src.domain.dungeon.model.core.structure.topology.SpatialTopology;

/**
 * Supplies room-interior cells used by authored stair geometry validation.
 */
public final class StairRoomInteriorQuery {
    private final RoomCellCoverage roomCellCoverage = new RoomCellCoverage();

    public Set<Cell> from(SpatialTopology topology, RoomCatalog rooms) {
        Set<Cell> result = new LinkedHashSet<>();
        for (DungeonRoomCluster cluster : topology == null ? List.<DungeonRoomCluster>of() : topology.roomClusters()) {
            result.addAll(clusterCells(cluster, rooms));
        }
        return Set.copyOf(result);
    }

    private Set<Cell> clusterCells(DungeonRoomCluster cluster, RoomCatalog rooms) {
        Set<Cell> result = new LinkedHashSet<>();
        for (List<Cell> cells : roomCellCoverage.cellsByRoom(
                cluster,
                clusterRooms(rooms, cluster.clusterId())).values()) {
            result.addAll(cells);
        }
        return result;
    }

    private static List<DungeonRoom> clusterRooms(RoomCatalog rooms, long clusterId) {
        List<DungeonRoom> result = new ArrayList<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms.rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }
}
