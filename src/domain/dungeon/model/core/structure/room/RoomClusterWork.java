package src.domain.dungeon.model.core.structure.room;

import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    public List<Cell> cellsAt(int level) {
        return cluster.cellsAt(level);
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return cluster.cellsByLevel();
    }

    public RoomClusterWork withCellsByLevel(Map<Integer, List<Cell>> nextCellsByLevel) {
        return new RoomClusterWork(cluster.withCellsByLevel(nextCellsByLevel), rooms);
    }

    public Optional<Room> rebuiltRoom() {
        Room template = rooms.isEmpty() ? null : rooms.getFirst();
        List<Cell> sortedCells = cluster.allCells();
        if (sortedCells.isEmpty()) {
            return Optional.empty();
        }
        long roomId = template == null ? fallbackRoomId() : template.roomId();
        String name = template == null ? "Raum " + roomId : template.name();
        return Optional.of(new Room(
                roomId,
                cluster.mapId(),
                cluster.clusterId(),
                name,
                Room.anchorsByLevel(cluster.cellsByLevel())));
    }

    private long fallbackRoomId() {
        long result = 0L;
        boolean found = false;
        for (Room room : rooms) {
            if (room != null && (!found || room.roomId() < result)) {
                result = room.roomId();
                found = true;
            }
        }
        return found ? result : Math.max(1L, cluster.clusterId());
    }

    public record ClusterRoomIds(long clusterId, long roomId) {
    }
}
