package features.world.quarantine.dungeonmap.foundation.db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonPersistenceGuards {

    private DungeonPersistenceGuards() {
        throw new AssertionError("No instances");
    }

    enum GuardedEntity {
        ROOM("dungeon_rooms", "room_id", "Raum"),
        CLUSTER("dungeon_room_clusters", "cluster_id", "Cluster"),
        CORRIDOR("dungeon_corridors", "corridor_id", "Korridor");

        final String table;
        final String idColumn;
        final String entityName;

        GuardedEntity(String table, String idColumn, String entityName) {
            this.table = table;
            this.idColumn = idColumn;
            this.entityName = entityName;
        }
    }

    private static void ensureBelongsToMap(Connection conn, long mapId, GuardedEntity entity,
            long entityId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM " + entity.table + " WHERE " + entity.idColumn + "=? AND dungeon_map_id=?")) {
            ps.setLong(1, entityId);
            ps.setLong(2, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return;
                }
            }
        }
        throw new SQLException(entity.entityName + " " + entityId + " gehört nicht zu Dungeon-Map " + mapId);
    }

    private static void ensureAllBelongToMap(Connection conn, long mapId, GuardedEntity entity,
            Collection<Long> entityIds) throws SQLException {
        if (entityIds.isEmpty()) return;
        String placeholders = entityIds.stream().map(id -> "?").collect(Collectors.joining(","));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT " + entity.idColumn + " FROM " + entity.table + " WHERE dungeon_map_id=? AND " + entity.idColumn + " IN (" + placeholders + ")")) {
            ps.setLong(1, mapId);
            int i = 2;
            for (Long id : entityIds) {
                ps.setLong(i++, id);
            }
            Set<Long> found = new HashSet<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    found.add(rs.getLong(entity.idColumn));
                }
            }
            for (Long id : entityIds) {
                if (!found.contains(id)) {
                    throw new SQLException(entity.entityName + " " + id + " gehört nicht zu Dungeon-Map " + mapId);
                }
            }
        }
    }

    public static void ensureRoomBelongsToMap(Connection conn, long mapId, long roomId) throws SQLException {
        ensureBelongsToMap(conn, mapId, GuardedEntity.ROOM, roomId);
    }

    public static void ensureClusterBelongsToMap(Connection conn, long mapId, long clusterId) throws SQLException {
        ensureBelongsToMap(conn, mapId, GuardedEntity.CLUSTER, clusterId);
    }

    public static void ensureCorridorBelongsToMap(Connection conn, long mapId, long corridorId) throws SQLException {
        ensureBelongsToMap(conn, mapId, GuardedEntity.CORRIDOR, corridorId);
    }

    public static void ensureRoomsBelongToMap(Connection conn, long mapId, Set<Long> roomIds) throws SQLException {
        ensureAllBelongToMap(conn, mapId, GuardedEntity.ROOM, roomIds);
    }

    public static void ensureClustersBelongToMap(Connection conn, long mapId, Set<Long> clusterIds) throws SQLException {
        ensureAllBelongToMap(conn, mapId, GuardedEntity.CLUSTER, clusterIds);
    }
}
