package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEndpointRole;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonEndpointRepository {

    private DungeonEndpointRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonEndpoint> getEndpoints(Connection conn, long mapId) throws SQLException {
        List<DungeonEndpoint> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.endpoint_id, e.map_id, e.square_id, e.name, e.notes, e.role, e.is_default_entry, s.x, s.y "
                        + "FROM dungeon_endpoints e "
                        + "JOIN dungeon_squares s ON s.square_id = e.square_id "
                        + "WHERE e.map_id=? ORDER BY e.endpoint_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapEndpoint(rs));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonEndpoint> findEndpoint(Connection conn, long endpointId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.endpoint_id, e.map_id, e.square_id, e.name, e.notes, e.role, e.is_default_entry, s.x, s.y "
                        + "FROM dungeon_endpoints e "
                        + "JOIN dungeon_squares s ON s.square_id = e.square_id "
                        + "WHERE e.endpoint_id=?")) {
            ps.setLong(1, endpointId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapEndpoint(rs));
            }
        }
    }

    public static long upsertEndpoint(Connection conn, DungeonEndpoint endpoint) throws SQLException {
        DungeonEndpointRole role = endpoint.role() == null ? DungeonEndpointRole.BOTH : endpoint.role();
        boolean defaultEntry = endpoint.defaultEntry() && role.allowsEntry();
        if (endpoint.endpointId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_endpoints(map_id, square_id, name, notes, role, is_default_entry) VALUES(?,?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, endpoint.mapId());
                ps.setLong(2, endpoint.squareId());
                ps.setString(3, endpoint.name());
                ps.setString(4, endpoint.notes());
                ps.setString(5, role.dbValue());
                ps.setBoolean(6, defaultEntry);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_endpoints insert");
                    }
                    long endpointId = keys.getLong(1);
                    if (defaultEntry) {
                        clearOtherDefaultEntries(conn, endpoint.mapId(), endpointId);
                    }
                    return endpointId;
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_endpoints SET name=?, notes=?, role=?, is_default_entry=? WHERE endpoint_id=?")) {
            ps.setString(1, endpoint.name());
            ps.setString(2, endpoint.notes());
            ps.setString(3, role.dbValue());
            ps.setBoolean(4, defaultEntry);
            ps.setLong(5, endpoint.endpointId());
            ps.executeUpdate();
            if (defaultEntry) {
                clearOtherDefaultEntries(conn, endpoint.mapId(), endpoint.endpointId());
            }
            return endpoint.endpointId();
        }
    }

    public static Optional<DungeonEndpoint> findDefaultEntry(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT e.endpoint_id, e.map_id, e.square_id, e.name, e.notes, e.role, e.is_default_entry, s.x, s.y "
                        + "FROM dungeon_endpoints e "
                        + "JOIN dungeon_squares s ON s.square_id = e.square_id "
                        + "WHERE e.map_id=? AND e.is_default_entry=1 "
                        + "ORDER BY e.endpoint_id LIMIT 1")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapEndpoint(rs));
            }
        }
    }

    public static void deleteEndpoint(Connection conn, long endpointId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_endpoints WHERE endpoint_id=?")) {
            ps.setLong(1, endpointId);
            ps.executeUpdate();
        }
    }

    private static DungeonEndpoint mapEndpoint(ResultSet rs) throws SQLException {
        return new DungeonEndpoint(
                rs.getLong("endpoint_id"),
                rs.getLong("map_id"),
                rs.getLong("square_id"),
                rs.getString("name"),
                rs.getString("notes"),
                DungeonEndpointRole.fromDbValue(rs.getString("role")),
                rs.getBoolean("is_default_entry"),
                rs.getInt("x"),
                rs.getInt("y"));
    }

    private static void clearOtherDefaultEntries(Connection conn, long mapId, long keepEndpointId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_endpoints SET is_default_entry=0 "
                        + "WHERE map_id=? AND endpoint_id<>? AND is_default_entry=1")) {
            ps.setLong(1, mapId);
            ps.setLong(2, keepEndpointId);
            ps.executeUpdate();
        }
    }
}
