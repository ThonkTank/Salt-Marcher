package features.world.dungeonmap.repository.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
public final class DungeonConceptConnectionRepository {

    private DungeonConceptConnectionRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonConceptLevelConnection> getConnections(Connection conn, long mapId) throws SQLException {
        List<DungeonConceptLevelConnection> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT concept_connection_id, map_id, level_a_id, level_b_id "
                        + "FROM dungeon_concept_level_connections "
                        + "WHERE map_id=? ORDER BY level_a_id, level_b_id, concept_connection_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(map(rs));
                }
            }
        }
        return result;
    }

    public static long insertConnection(Connection conn, DungeonConceptLevelConnection connection) throws SQLException {
        long orderedA = Math.min(connection.levelAId(), connection.levelBId());
        long orderedB = Math.max(connection.levelAId(), connection.levelBId());
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_concept_level_connections(map_id, level_a_id, level_b_id) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, connection.mapId());
            ps.setLong(2, orderedA);
            ps.setLong(3, orderedB);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_concept_level_connections insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static java.util.Optional<DungeonConceptLevelConnection> findConnection(Connection conn, long connectionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT concept_connection_id, map_id, level_a_id, level_b_id "
                        + "FROM dungeon_concept_level_connections WHERE concept_connection_id=?")) {
            ps.setLong(1, connectionId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return java.util.Optional.empty();
                }
                return java.util.Optional.of(map(rs));
            }
        }
    }

    public static void deleteConnection(Connection conn, long connectionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_concept_level_connections WHERE concept_connection_id=?")) {
            ps.setLong(1, connectionId);
            ps.executeUpdate();
        }
    }

    private static DungeonConceptLevelConnection map(ResultSet rs) throws SQLException {
        return new DungeonConceptLevelConnection(
                rs.getLong("concept_connection_id"),
                rs.getLong("map_id"),
                rs.getLong("level_a_id"),
                rs.getLong("level_b_id"));
    }
}
