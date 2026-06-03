package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;

final class DungeonStairRoomInteriorValidationLogic {
    private final DungeonRoomCellProjection roomCellProjection = new DungeonRoomCellProjection();

    boolean avoidsRoomInteriors(
            SpatialTopology topology,
            RoomCatalog rooms,
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2
    ) {
        if (invalidInput(topology, rooms, shape, anchor, direction)) {
            return false;
        }
        StairGeometrySpec spec = DungeonStairGeometryValues.geometrySpec(
                shape,
                anchor,
                direction,
                dimension1,
                dimension2);
        return spec != null && spec.avoidsRoomInteriors(roomCells(topology, rooms));
    }

    private static boolean invalidInput(
            SpatialTopology topology,
            RoomCatalog rooms,
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction
    ) {
        return topology == null || rooms == null || shape == null || anchor == null || direction == null;
    }

    private Set<Cell> roomCells(SpatialTopology topology, RoomCatalog rooms) {
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
