package features.dungeon.domain.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

public record RoomClusterWork(
        RoomClusterGeometry cluster,
        List<RoomRegion> rooms
) {
    public RoomClusterWork {
        cluster = cluster == null ? RoomClusterGeometry.fromCells(0L, 0L, Set.of()) : cluster;
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }

    public static RoomClusterWork newClusterWork(ClusterRoomIds ids, long mapId, Set<Cell> cells) {
        RoomClusterGeometry cluster = RoomClusterGeometry.fromCells(ids.clusterId(), mapId, cells);
        RoomRegion room = new RoomRegion(
                ids.roomId(),
                mapId,
                ids.clusterId(),
                "Raum " + ids.roomId(),
                cells,
                DungeonRoomNarration.empty());
        return new RoomClusterWork(cluster, List.of(room));
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return cluster.cellsByLevel();
    }

    public record ClusterRoomIds(long clusterId, long roomId) {
    }
}
