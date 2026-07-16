package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

public final class RoomClusterRoomPartition {

    private RoomClusterRoomPartition() {
    }

    public static List<Room> roomsForBoundaryEdit(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel,
            long nextRoomId
    ) {
        return RoomClusterRoomComponents.roomsForMutation(
                safeWork(work),
                closedBoundaryEdgesByLevel,
                nextRoomId,
                null);
    }

    public static List<Room> roomsForMutation(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel,
            long nextRoomId,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        return RoomClusterRoomComponents.roomsForMutation(
                safeWork(work),
                closedBoundaryEdgesByLevel,
                nextRoomId,
                previousCellsByRoom);
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
