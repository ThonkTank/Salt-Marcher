package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

public record ClusterRewriteSplit(
        Long clusterId,
        CellCoord clusterCenter,
        List<Room> rooms
) {
    public ClusterRewriteSplit {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }

    public ClusterRewriteSplit withClusterId(Long clusterId) {
        List<Room> reassignedRooms = rooms.stream()
                .map(room -> reassignCluster(room, clusterId))
                .toList();
        return new ClusterRewriteSplit(clusterId, clusterCenter, reassignedRooms);
    }

    private static Room reassignCluster(Room room, Long clusterId) {
        if (room == null) {
            return null;
        }
        long resolvedClusterId = clusterId == null ? room.clusterId() : clusterId;
        return Room.resolved(
                room.roomId(),
                room.mapId(),
                resolvedClusterId,
                room.name(),
                room.structure(),
                room.narration());
    }
}
