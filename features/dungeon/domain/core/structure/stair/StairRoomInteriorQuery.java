package features.dungeon.domain.core.structure.stair;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomCatalog;
import features.dungeon.domain.core.structure.room.RoomCellCoverage;
import features.dungeon.domain.core.structure.topology.SpatialTopology;

/**
 * Supplies room-interior cells used by authored stair geometry validation.
 */
public final class StairRoomInteriorQuery {
    private final RoomCellCoverage roomCellCoverage = new RoomCellCoverage();

    public Set<Cell> from(SpatialTopology topology, RoomCatalog rooms) {
        Set<Cell> result = new LinkedHashSet<>();
        for (RoomCluster cluster : topology == null ? List.<RoomCluster>of() : topology.roomClusters()) {
            result.addAll(clusterCells(cluster, rooms));
        }
        return Set.copyOf(result);
    }

    private Set<Cell> clusterCells(RoomCluster cluster, RoomCatalog rooms) {
        Set<Cell> result = new LinkedHashSet<>();
        for (List<Cell> cells : roomCellCoverage.cellsByRoom(
                cluster,
                clusterRooms(rooms, cluster.clusterId())).values()) {
            result.addAll(cells);
        }
        return result;
    }

    private static List<RoomRegion> clusterRooms(RoomCatalog rooms, long clusterId) {
        List<RoomRegion> result = new ArrayList<>();
        for (RoomRegion room : rooms == null ? List.<RoomRegion>of() : rooms.rooms()) {
            if (room != null && room.clusterId() == clusterId) {
                result.add(room);
            }
        }
        return List.copyOf(result);
    }
}
