package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;

public final class RoomClusterRoomPartition {

    private RoomClusterRoomPartition() {
    }

    public static List<RoomRegion> roomsForBoundaryEdit(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel,
            RoomTopologyWorkCatalog.ReservedIdentities identities
    ) {
        return RoomClusterRoomComponents.roomsForMutation(
                safeWork(work),
                closedBoundaryEdgesByLevel,
                new RoomMutationIdCursor(identities),
                null);
    }

    static List<RoomRegion> roomsForMutation(
            RoomClusterWork work,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel,
            RoomMutationIdCursor ids,
            Map<Long, List<Cell>> previousCellsByRoom
    ) {
        return RoomClusterRoomComponents.roomsForMutation(
                safeWork(work),
                closedBoundaryEdgesByLevel,
                ids,
                previousCellsByRoom);
    }

    public static Map<Long, List<Cell>> cellsByRoom(
            RoomClusterGeometry cluster,
            List<RoomRegion> rooms,
            Map<Integer, ? extends Iterable<Edge>> closedBoundaryEdgesByLevel
    ) {
        return RoomClusterRoomAssignment.cellsByRoom(safeCluster(cluster), rooms, closedBoundaryEdgesByLevel);
    }

    private static RoomClusterWork safeWork(RoomClusterWork work) {
        return work == null ? new RoomClusterWork(null, List.of()) : work;
    }

    private static RoomClusterGeometry safeCluster(RoomClusterGeometry cluster) {
        return cluster == null ? RoomClusterGeometry.fromCells(0L, 0L, Set.of()) : cluster;
    }

}
