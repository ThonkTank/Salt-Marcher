package features.world.dungeonmap.repository.connection;

import features.world.dungeonmap.model.domain.DungeonConnectionPoint;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class DungeonConnectionPointRepository {

    private DungeonConnectionPointRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonConnectionPoint> getPoints(Connection conn, long mapId) throws SQLException {
        List<DungeonConnectionPoint> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT points.connection_point_id, points.connection_id, points.sort_order, points.x, points.y "
                        + "FROM dungeon_connection_points points "
                        + "JOIN dungeon_connections connections ON connections.connection_id = points.connection_id "
                        + "WHERE connections.map_id=? "
                        + "ORDER BY points.connection_id, points.sort_order, points.connection_point_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(map(rs));
                }
            }
        }
        return result;
    }

    public static List<DungeonConnectionPoint> getPointsForConnection(Connection conn, long connectionId) throws SQLException {
        List<DungeonConnectionPoint> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT connection_point_id, connection_id, sort_order, x, y "
                        + "FROM dungeon_connection_points WHERE connection_id=? "
                        + "ORDER BY sort_order, connection_point_id")) {
            ps.setLong(1, connectionId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(map(rs));
                }
            }
        }
        return result;
    }

    public static long insertPoint(Connection conn, DungeonConnectionPoint point) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_connection_points(connection_id, sort_order, x, y) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, point.connectionId());
            ps.setInt(2, point.sortOrder());
            ps.setInt(3, point.x());
            ps.setInt(4, point.y());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_connection_points insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void replacePoints(Connection conn, long connectionId, List<DungeonConnectionPoint> points) throws SQLException {
        deletePointsForConnection(conn, connectionId);
        if (points == null || points.isEmpty()) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_connection_points(connection_id, sort_order, x, y) VALUES(?,?,?,?)")) {
            for (DungeonConnectionPoint point : points) {
                if (point == null) {
                    continue;
                }
                ps.setLong(1, connectionId);
                ps.setInt(2, point.sortOrder());
                ps.setInt(3, point.x());
                ps.setInt(4, point.y());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static void deletePointsForConnection(Connection conn, long connectionId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_connection_points WHERE connection_id=?")) {
            ps.setLong(1, connectionId);
            ps.executeUpdate();
        }
    }

    private static DungeonConnectionPoint map(ResultSet rs) throws SQLException {
        return new DungeonConnectionPoint(
                rs.getLong("connection_point_id"),
                rs.getLong("connection_id"),
                rs.getInt("sort_order"),
                rs.getInt("x"),
                rs.getInt("y"));
    }
}
