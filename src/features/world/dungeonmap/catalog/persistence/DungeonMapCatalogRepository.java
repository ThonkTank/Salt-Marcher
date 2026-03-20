package features.world.dungeonmap.catalog.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Optional;

final class DungeonMapCatalogRepository {

    private DungeonMapCatalogRepository() {
        throw new AssertionError("No instances");
    }

    static Optional<Long> firstMapId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id FROM dungeon_maps ORDER BY dungeon_map_id LIMIT 1");
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                return Optional.of(rs.getLong(1));
            }
            return Optional.empty();
        }
    }

    static long insertMap(Connection conn, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_maps(name) VALUES(?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_maps insert");
                }
                return rs.getLong(1);
            }
        }
    }

    static void updateMapName(Connection conn, long mapId, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_maps SET name=? WHERE dungeon_map_id=?")) {
            ps.setString(1, name);
            ps.setLong(2, mapId);
            ps.executeUpdate();
        }
    }

    static void deleteMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }
}
