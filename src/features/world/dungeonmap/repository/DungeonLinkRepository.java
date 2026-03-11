package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonLink;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonLinkRepository {

    private DungeonLinkRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonLink> getLinks(Connection conn, long mapId) throws SQLException {
        List<DungeonLink> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT link_id, map_id, from_endpoint_id, to_endpoint_id, label, notes "
                        + "FROM dungeon_links WHERE map_id=? ORDER BY link_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonLink(
                            rs.getLong("link_id"),
                            rs.getLong("map_id"),
                            rs.getLong("from_endpoint_id"),
                            rs.getLong("to_endpoint_id"),
                            rs.getString("label"),
                            rs.getString("notes")));
                }
            }
        }
        return result;
    }

    public static Optional<Long> findExistingLink(Connection conn, long mapId, long endpointA, long endpointB) throws SQLException {
        long first = Math.min(endpointA, endpointB);
        long second = Math.max(endpointA, endpointB);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT link_id FROM dungeon_links WHERE map_id=? AND from_endpoint_id=? AND to_endpoint_id=?")) {
            ps.setLong(1, mapId);
            ps.setLong(2, first);
            ps.setLong(3, second);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(rs.getLong("link_id"));
                }
            }
        }
        return Optional.empty();
    }

    public static long insertLink(Connection conn, DungeonLink link) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_links(map_id, from_endpoint_id, to_endpoint_id, label, notes) VALUES(?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, link.mapId());
            ps.setLong(2, Math.min(link.fromEndpointId(), link.toEndpointId()));
            ps.setLong(3, Math.max(link.fromEndpointId(), link.toEndpointId()));
            ps.setString(4, link.label());
            ps.setString(5, link.notes());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_links insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void deleteLink(Connection conn, long linkId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_links WHERE link_id=?")) {
            ps.setLong(1, linkId);
            ps.executeUpdate();
        }
    }

    public static void updateLinkLabel(Connection conn, long linkId, String label) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_links SET label=? WHERE link_id=?")) {
            ps.setString(1, label);
            ps.setLong(2, linkId);
            ps.executeUpdate();
        }
    }

    public static boolean areEndpointsLinked(Connection conn, long mapId, long endpointA, long endpointB) throws SQLException {
        return findExistingLink(conn, mapId, endpointA, endpointB).isPresent();
    }
}
