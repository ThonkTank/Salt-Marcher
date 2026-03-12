package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonMap;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonMapRepository {

    private DungeonMapRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonMap> getAllMaps(Connection conn) throws SQLException {
        List<DungeonMap> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name, width, height FROM dungeon_maps ORDER BY dungeon_map_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                result.add(new DungeonMap(
                        rs.getLong("dungeon_map_id"),
                        rs.getString("name"),
                        rs.getInt("width"),
                        rs.getInt("height")));
            }
        }
        return result;
    }

    public static long insertMap(Connection conn, DungeonMap map) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_maps(name, width, height) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, map.name());
            ps.setInt(2, map.width());
            ps.setInt(3, map.height());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_maps insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void updateMap(Connection conn, long mapId, String name, int width, int height) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_maps SET name=?, width=?, height=? WHERE dungeon_map_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, width);
            ps.setInt(3, height);
            ps.setLong(4, mapId);
            ps.executeUpdate();
        }
    }

    public static void deleteMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }

    public static void deleteSquaresOutsideBounds(Connection conn, long mapId, int width, int height) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_squares WHERE map_id=? AND (x >= ? OR y >= ?)")) {
            ps.setLong(1, mapId);
            ps.setInt(2, width);
            ps.setInt(3, height);
            ps.executeUpdate();
        }
    }

    public static Optional<DungeonMap> findMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name, width, height FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new DungeonMap(
                        rs.getLong("dungeon_map_id"),
                        rs.getString("name"),
                        rs.getInt("width"),
                        rs.getInt("height")));
            }
        }
    }
}
