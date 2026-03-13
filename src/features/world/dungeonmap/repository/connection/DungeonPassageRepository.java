package features.world.dungeonmap.repository.connection;

import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.PassageDirection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonPassageRepository {

    private DungeonPassageRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonPassage> getPassages(Connection conn, long mapId) throws SQLException {
        String sql = "SELECT passage_id, map_id, x, y, direction, name, notes, endpoint_id "
                + "FROM dungeon_passages WHERE map_id=? ORDER BY passage_id";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonPassage> result = new ArrayList<>();
                while (rs.next()) {
                    result.add(mapRow(rs));
                }
                return result;
            }
        }
    }

    public static long upsertPassage(Connection conn, DungeonPassage passage) throws SQLException {
        if (passage.passageId() == null) {
            String sql = "INSERT INTO dungeon_passages(map_id, x, y, direction, name, notes, endpoint_id) "
                    + "VALUES(?,?,?,?,?,?,?) "
                    + "ON CONFLICT(map_id, x, y, direction) DO UPDATE SET "
                    + "name=excluded.name, notes=excluded.notes, endpoint_id=excluded.endpoint_id";
            try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, passage.mapId());
                ps.setInt(2, passage.x());
                ps.setInt(3, passage.y());
                ps.setString(4, passage.direction().dbValue());
                ps.setString(5, passage.name());
                ps.setString(6, passage.notes());
                if (passage.endpointId() != null) {
                    ps.setLong(7, passage.endpointId());
                } else {
                    ps.setNull(7, java.sql.Types.INTEGER);
                }
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) {
                        return keys.getLong(1);
                    }
                }
                // ON CONFLICT UPDATE doesn't return generated key — fetch it
                return fetchPassageId(conn, passage.mapId(), passage.x(), passage.y(), passage.direction());
            }
        } else {
            String sql = "UPDATE dungeon_passages SET name=?, notes=?, endpoint_id=? "
                    + "WHERE passage_id=?";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, passage.name());
                ps.setString(2, passage.notes());
                if (passage.endpointId() != null) {
                    ps.setLong(3, passage.endpointId());
                } else {
                    ps.setNull(3, java.sql.Types.INTEGER);
                }
                ps.setLong(4, passage.passageId());
                ps.executeUpdate();
                return passage.passageId();
            }
        }
    }

    public static Optional<DungeonPassage> findPassage(Connection conn, long passageId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT passage_id, map_id, x, y, direction, name, notes, endpoint_id "
                        + "FROM dungeon_passages WHERE passage_id=?")) {
            ps.setLong(1, passageId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapRow(rs));
            }
        }
    }

    public static void deletePassage(Connection conn, long passageId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_passages WHERE passage_id=?")) {
            ps.setLong(1, passageId);
            ps.executeUpdate();
        }
    }

    public static List<Long> findIdsByEdge(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT passage_id FROM dungeon_passages WHERE map_id=? AND x=? AND y=? AND direction=?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, x);
            ps.setInt(3, y);
            ps.setString(4, direction.dbValue());
            try (ResultSet rs = ps.executeQuery()) {
                List<Long> result = new ArrayList<>();
                while (rs.next()) {
                    result.add(rs.getLong("passage_id"));
                }
                return result;
            }
        }
    }

    private static long fetchPassageId(Connection conn, long mapId, int x, int y, PassageDirection dir) throws SQLException {
        List<Long> ids = findIdsByEdge(conn, mapId, x, y, dir);
        if (!ids.isEmpty()) {
            return ids.get(0);
        }
        throw new SQLException("Passage not found after upsert");
    }

    private static DungeonPassage mapRow(ResultSet rs) throws SQLException {
        long passageId = rs.getLong("passage_id");
        long mapId = rs.getLong("map_id");
        int x = rs.getInt("x");
        int y = rs.getInt("y");
        PassageDirection dir;
        try {
            dir = PassageDirection.fromDb(rs.getString("direction"));
        } catch (IllegalArgumentException ex) {
            throw new SQLException("Invalid dungeon passage enum value for passage_id=" + passageId, ex);
        }
        String name = rs.getString("name");
        String notes = rs.getString("notes");
        long endpointIdRaw = rs.getLong("endpoint_id");
        Long endpointId = rs.wasNull() ? null : endpointIdRaw;
        return new DungeonPassage(passageId, mapId, x, y, dir, name, notes, endpointId);
    }
}
