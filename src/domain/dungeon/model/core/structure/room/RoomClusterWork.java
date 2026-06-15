package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;

public record RoomClusterWork(
        RoomCluster cluster,
        List<Room> rooms
) {
    public RoomClusterWork {
        cluster = cluster == null ? RoomCluster.fromCells(0L, 0L, Set.of()) : cluster;
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }

    public static RoomClusterWork newClusterWork(ClusterRoomIds ids, long mapId, Set<Cell> cells) {
        RoomCluster cluster = RoomCluster.fromCells(ids.clusterId(), mapId, cells);
        Room room = new Room(
                ids.roomId(),
                mapId,
                ids.clusterId(),
                "Raum " + ids.roomId(),
                Room.anchorsByLevel(cluster.cellsByLevel()));
        return new RoomClusterWork(cluster, List.of(room));
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return cluster.cellsByLevel();
    }

    public record ClusterRoomIds(long clusterId, long roomId) {
    }
}
