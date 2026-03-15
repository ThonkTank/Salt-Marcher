package features.world.dungeonmap.repository.connection;

import features.world.dungeonmap.model.domain.DungeonConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public final class DungeonConnectionRepository {

    private DungeonConnectionRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonConnection> getConnections(Connection conn, long mapId) throws SQLException {
        List<DungeonConnection> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT connection_id, map_id, concept_level_id, left_node_key, right_node_key "
                        + "FROM dungeon_connections "
                        + "WHERE map_id=? ORDER BY concept_level_id, left_node_key, right_node_key, connection_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(map(rs));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonConnection> findConnection(Connection conn, long connectionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT connection_id, map_id, concept_level_id, left_node_key, right_node_key "
                        + "FROM dungeon_connections WHERE connection_id=?")) {
            ps.setLong(1, connectionId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(map(rs));
            }
        }
    }

    public static long insertConnection(Connection conn, DungeonConnection connection) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_connections(map_id, concept_level_id, left_node_key, right_node_key) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, connection.mapId());
            ps.setLong(2, connection.conceptLevelId());
            ps.setString(3, connection.leftNodeKey());
            ps.setString(4, connection.rightNodeKey());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_connections insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void insertConnectionsIgnoreDuplicates(Connection conn, Collection<DungeonConnection> connections) throws SQLException {
        if (connections == null || connections.isEmpty()) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR IGNORE INTO dungeon_connections(map_id, concept_level_id, left_node_key, right_node_key) VALUES(?,?,?,?)")) {
            for (DungeonConnection connection : connections) {
                if (connection == null) {
                    continue;
                }
                ps.setLong(1, connection.mapId());
                ps.setLong(2, connection.conceptLevelId());
                ps.setString(3, connection.leftNodeKey());
                ps.setString(4, connection.rightNodeKey());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static void deleteConnection(Connection conn, long connectionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_connections WHERE connection_id=?")) {
            ps.setLong(1, connectionId);
            ps.executeUpdate();
        }
    }

    public static void deleteConnectionsForNode(Connection conn, long conceptLevelId, String nodeKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_connections WHERE concept_level_id=? AND (left_node_key=? OR right_node_key=?)")) {
            ps.setLong(1, conceptLevelId);
            ps.setString(2, nodeKey);
            ps.setString(3, nodeKey);
            ps.executeUpdate();
        }
    }

    public static void deleteConnectionsForNode(Connection conn, String nodeKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_connections WHERE left_node_key=? OR right_node_key=?")) {
            ps.setString(1, nodeKey);
            ps.setString(2, nodeKey);
            ps.executeUpdate();
        }
    }

    private static DungeonConnection map(ResultSet rs) throws SQLException {
        return new DungeonConnection(
                rs.getLong("connection_id"),
                rs.getLong("map_id"),
                rs.getLong("concept_level_id"),
                rs.getString("left_node_key"),
                rs.getString("right_node_key"));
    }
}
