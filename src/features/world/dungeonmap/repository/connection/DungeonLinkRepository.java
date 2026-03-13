package features.world.dungeonmap.repository.connection;

import features.world.dungeonmap.model.domain.DungeonLink;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonLinkAnchorType;

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
                "SELECT link_id, map_id, from_anchor_type, from_anchor_id, to_anchor_type, to_anchor_id, label, notes "
                        + "FROM dungeon_links WHERE map_id=? ORDER BY link_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonLink(
                            rs.getLong("link_id"),
                            rs.getLong("map_id"),
                            mapAnchor(rs, "from"),
                            mapAnchor(rs, "to"),
                            rs.getString("label"),
                            rs.getString("notes")));
                }
            }
        }
        return result;
    }

    public static Optional<Long> findExistingLink(Connection conn, long mapId, DungeonLinkAnchor anchorA, DungeonLinkAnchor anchorB) throws SQLException {
        OrderedAnchors orderedAnchors = orderAnchors(anchorA, anchorB);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT link_id FROM dungeon_links "
                        + "WHERE map_id=? AND from_anchor_type=? AND from_anchor_id=? AND to_anchor_type=? AND to_anchor_id=?")) {
            ps.setLong(1, mapId);
            ps.setString(2, orderedAnchors.from().type().dbValue());
            ps.setLong(3, orderedAnchors.from().anchorId());
            ps.setString(4, orderedAnchors.to().type().dbValue());
            ps.setLong(5, orderedAnchors.to().anchorId());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(rs.getLong("link_id"));
                }
            }
        }
        return Optional.empty();
    }

    public static long insertLink(Connection conn, DungeonLink link) throws SQLException {
        OrderedAnchors orderedAnchors = orderAnchors(link.fromAnchor(), link.toAnchor());
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_links(map_id, from_anchor_type, from_anchor_id, to_anchor_type, to_anchor_id, label, notes) VALUES(?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, link.mapId());
            ps.setString(2, orderedAnchors.from().type().dbValue());
            ps.setLong(3, orderedAnchors.from().anchorId());
            ps.setString(4, orderedAnchors.to().type().dbValue());
            ps.setLong(5, orderedAnchors.to().anchorId());
            ps.setString(6, link.label());
            ps.setString(7, link.notes());
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

    public static void deleteLinksTouchingAnchor(Connection conn, DungeonLinkAnchor anchor) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_links "
                        + "WHERE (from_anchor_type=? AND from_anchor_id=?) "
                        + "OR (to_anchor_type=? AND to_anchor_id=?)")) {
            ps.setString(1, anchor.type().dbValue());
            ps.setLong(2, anchor.anchorId());
            ps.setString(3, anchor.type().dbValue());
            ps.setLong(4, anchor.anchorId());
            ps.executeUpdate();
        }
    }

    public static void deleteLinksWithMissingAnchors(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_links WHERE map_id=? AND ("
                        + "(from_anchor_type='endpoint' AND NOT EXISTS ("
                        + "SELECT 1 FROM dungeon_endpoints e WHERE e.endpoint_id=dungeon_links.from_anchor_id AND e.map_id=dungeon_links.map_id))"
                        + " OR "
                        + "(from_anchor_type='passage' AND NOT EXISTS ("
                        + "SELECT 1 FROM dungeon_passages p WHERE p.passage_id=dungeon_links.from_anchor_id AND p.map_id=dungeon_links.map_id))"
                        + " OR "
                        + "(to_anchor_type='endpoint' AND NOT EXISTS ("
                        + "SELECT 1 FROM dungeon_endpoints e WHERE e.endpoint_id=dungeon_links.to_anchor_id AND e.map_id=dungeon_links.map_id))"
                        + " OR "
                        + "(to_anchor_type='passage' AND NOT EXISTS ("
                        + "SELECT 1 FROM dungeon_passages p WHERE p.passage_id=dungeon_links.to_anchor_id AND p.map_id=dungeon_links.map_id))"
                        + ")")) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }

    public static boolean areAnchorsLinked(Connection conn, long mapId, DungeonLinkAnchor anchorA, DungeonLinkAnchor anchorB) throws SQLException {
        return findExistingLink(conn, mapId, anchorA, anchorB).isPresent();
    }

    private static DungeonLinkAnchor mapAnchor(ResultSet rs, String prefix) throws SQLException {
        return new DungeonLinkAnchor(
                DungeonLinkAnchorType.fromDbValue(rs.getString(prefix + "_anchor_type")),
                rs.getLong(prefix + "_anchor_id"));
    }

    private static OrderedAnchors orderAnchors(DungeonLinkAnchor anchorA, DungeonLinkAnchor anchorB) {
        if (compareAnchors(anchorA, anchorB) <= 0) {
            return new OrderedAnchors(anchorA, anchorB);
        }
        return new OrderedAnchors(anchorB, anchorA);
    }

    private static int compareAnchors(DungeonLinkAnchor left, DungeonLinkAnchor right) {
        int typeCompare = Integer.compare(left.type().persistenceOrder(), right.type().persistenceOrder());
        if (typeCompare != 0) {
            return typeCompare;
        }
        return Long.compare(left.anchorId(), right.anchorId());
    }

    private record OrderedAnchors(DungeonLinkAnchor from, DungeonLinkAnchor to) {
    }
}
