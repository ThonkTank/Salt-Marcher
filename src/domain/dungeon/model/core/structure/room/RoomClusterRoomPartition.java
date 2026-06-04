package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

public final class RoomClusterRoomPartition {

    private RoomClusterRoomPartition() {
    }

    public static List<Room> roomsForBoundaryEdit(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel,
            long nextRoomId
    ) {
        return RoomClusterRoomComponents.roomsForBoundaryEdit(
                safeWork(work),
                closedBoundaryEdgesByLevel,
                nextRoomId);
    }

    public static Map<Long, List<Cell>> cellsByRoom(
            RoomCluster cluster,
            List<Room> rooms,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel
    ) {
        return RoomClusterRoomAssignment.cellsByRoom(safeCluster(cluster), rooms, closedBoundaryEdgesByLevel);
    }

    private static RoomClusterWork safeWork(RoomClusterWork work) {
        return work == null ? new RoomClusterWork(null, List.of()) : work;
    }

    private static RoomCluster safeCluster(RoomCluster cluster) {
        return cluster == null ? RoomCluster.fromCells(0L, 0L, Set.of()) : cluster;
    }

}
