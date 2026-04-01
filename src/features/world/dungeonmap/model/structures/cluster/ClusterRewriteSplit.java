package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

public record ClusterRewriteSplit(
        Long clusterId,
        Point2i clusterCenter,
        List<Room> rooms,
        List<LocalConnection> localConnections,
        List<InternalBoundaryEdge> persistedBoundaries
) {
    public ClusterRewriteSplit {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        localConnections = localConnections == null ? List.of() : List.copyOf(localConnections);
        persistedBoundaries = persistedBoundaries == null ? List.of() : List.copyOf(persistedBoundaries);
    }

    public ClusterRewriteSplit withClusterId(Long clusterId) {
        List<Room> reassignedRooms = rooms.stream()
                .map(room -> reassignCluster(room, clusterId))
                .toList();
        List<LocalConnection> reassignedConnections = localConnections.stream()
                .map(connection -> reassignCluster(connection, clusterId))
                .toList();
        return new ClusterRewriteSplit(clusterId, clusterCenter, reassignedRooms, reassignedConnections, persistedBoundaries);
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

    private static LocalConnection reassignCluster(LocalConnection connection, Long clusterId) {
        if (connection == null) {
            return null;
        }
        long resolvedClusterId = clusterId == null ? connection.clusterId() : clusterId;
        return new LocalConnection(
                connection.connectionId(),
                connection.mapId(),
                resolvedClusterId,
                connection.levelZ(),
                connection.door(),
                connection.endpoints());
    }
}
