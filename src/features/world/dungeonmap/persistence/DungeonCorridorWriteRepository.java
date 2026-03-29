package features.world.dungeonmap.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public final class DungeonCorridorWriteRepository {

    public long insertTraversalCorridor(Connection conn, long mapId, long traversalId) throws SQLException {
        return insertTraversalCorridor(conn, mapId, traversalId, null);
    }

    public long insertTraversalCorridor(Connection conn, long mapId, long traversalId, String segmentKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, traversal_id, segment_key) VALUES(?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, traversalId);
            ps.setString(3, segmentKey);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateTraversalCorridorSegmentKey(Connection conn, long corridorId, String segmentKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET segment_key=? WHERE corridor_id=?")) {
            ps.setString(1, segmentKey);
            ps.setLong(2, corridorId);
            ps.executeUpdate();
        }
    }

    public void deleteByTraversalId(Connection conn, long traversalId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE traversal_id=?")) {
            ps.setLong(1, traversalId);
            ps.executeUpdate();
        }
    }

    public void deleteCorridor(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }
}
