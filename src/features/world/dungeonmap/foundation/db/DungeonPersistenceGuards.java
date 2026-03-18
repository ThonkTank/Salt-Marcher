package features.world.dungeonmap.foundation.db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonPersistenceGuards {

    private DungeonPersistenceGuards() {
    }

    public static void ensureRoomBelongsToMap(Connection conn, long mapId, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_rooms WHERE room_id=? AND dungeon_map_id=?")) {
            ps.setLong(1, roomId);
            ps.setLong(2, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return;
                }
            }
        }
        throw new SQLException("Raum " + roomId + " gehört nicht zu Dungeon-Map " + mapId);
    }

    public static void ensureClusterBelongsToMap(Connection conn, long mapId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_room_clusters WHERE cluster_id=? AND dungeon_map_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return;
                }
            }
        }
        throw new SQLException("Cluster " + clusterId + " gehört nicht zu Dungeon-Map " + mapId);
    }

    public static void ensureRoomsBelongToMap(Connection conn, long mapId, Set<Long> roomIds) throws SQLException {
        if (roomIds.isEmpty()) return;
        String placeholders = roomIds.stream().map(id -> "?").collect(Collectors.joining(","));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=? AND room_id IN (" + placeholders + ")")) {
            ps.setLong(1, mapId);
            int i = 2;
            for (Long id : roomIds) {
                ps.setLong(i++, id);
            }
            Set<Long> found = new HashSet<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    found.add(rs.getLong("room_id"));
                }
            }
            for (Long id : roomIds) {
                if (!found.contains(id)) {
                    throw new SQLException("Raum " + id + " gehört nicht zu Dungeon-Map " + mapId);
                }
            }
        }
    }

    public static void ensureClustersBelongToMap(Connection conn, long mapId, Set<Long> clusterIds) throws SQLException {
        if (clusterIds.isEmpty()) return;
        String placeholders = clusterIds.stream().map(id -> "?").collect(Collectors.joining(","));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=? AND cluster_id IN (" + placeholders + ")")) {
            ps.setLong(1, mapId);
            int i = 2;
            for (Long id : clusterIds) {
                ps.setLong(i++, id);
            }
            Set<Long> found = new HashSet<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    found.add(rs.getLong("cluster_id"));
                }
            }
            for (Long id : clusterIds) {
                if (!found.contains(id)) {
                    throw new SQLException("Cluster " + id + " gehört nicht zu Dungeon-Map " + mapId);
                }
            }
        }
    }

    public static void ensureCorridorBelongsToMap(Connection conn, long mapId, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_corridors WHERE corridor_id=? AND dungeon_map_id=?")) {
            ps.setLong(1, corridorId);
            ps.setLong(2, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return;
                }
            }
        }
        throw new SQLException("Korridor " + corridorId + " gehört nicht zu Dungeon-Map " + mapId);
    }
}
