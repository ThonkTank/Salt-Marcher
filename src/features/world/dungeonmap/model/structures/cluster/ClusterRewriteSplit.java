package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.ClusterBoundaryWrite;

import java.util.List;

public record ClusterRewriteSplit(
        Long clusterId,
        TileShape clusterShape,
        Point2i clusterCenter,
        List<Room> rooms,
        List<ClusterBoundaryWrite> persistedBoundaries
) {
    public ClusterRewriteSplit {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        persistedBoundaries = persistedBoundaries == null ? List.of() : List.copyOf(persistedBoundaries);
    }

    public ClusterRewriteSplit withClusterId(Long clusterId) {
        List<Room> reassignedRooms = rooms.stream()
                .map(room -> reassignCluster(room, clusterId))
                .toList();
        return new ClusterRewriteSplit(clusterId, clusterShape, clusterCenter, reassignedRooms, persistedBoundaries);
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
                room.floor(),
                room.walls(),
                room.doorEdges(),
                room.narration());
    }
}
