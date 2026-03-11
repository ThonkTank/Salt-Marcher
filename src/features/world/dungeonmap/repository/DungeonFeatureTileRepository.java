package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonFeatureTile;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class DungeonFeatureTileRepository {

    private DungeonFeatureTileRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonFeatureTile> getFeatureTiles(Connection conn, long mapId) throws SQLException {
        List<DungeonFeatureTile> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT t.feature_id, t.square_id, s.x, s.y "
                        + "FROM dungeon_feature_tiles t "
                        + "JOIN dungeon_features f ON f.feature_id = t.feature_id "
                        + "JOIN dungeon_squares s ON s.square_id = t.square_id "
                        + "WHERE f.map_id=? ORDER BY t.feature_id, s.y, s.x")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonFeatureTile(
                            rs.getLong("feature_id"),
                            rs.getLong("square_id"),
                            rs.getInt("x"),
                            rs.getInt("y")));
                }
            }
        }
        return result;
    }

    public static List<DungeonFeatureTile> getTilesForFeature(Connection conn, long featureId) throws SQLException {
        List<DungeonFeatureTile> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT t.feature_id, t.square_id, s.x, s.y "
                        + "FROM dungeon_feature_tiles t "
                        + "JOIN dungeon_squares s ON s.square_id = t.square_id "
                        + "WHERE t.feature_id=? ORDER BY s.y, s.x")) {
            ps.setLong(1, featureId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonFeatureTile(
                            rs.getLong("feature_id"),
                            rs.getLong("square_id"),
                            rs.getInt("x"),
                            rs.getInt("y")));
                }
            }
        }
        return result;
    }

    public static boolean featureContainsSquare(Connection conn, long featureId, long squareId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_feature_tiles WHERE feature_id=? AND square_id=?")) {
            ps.setLong(1, featureId);
            ps.setLong(2, squareId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public static void addTile(Connection conn, long featureId, long squareId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR IGNORE INTO dungeon_feature_tiles(feature_id, square_id) VALUES(?,?)")) {
            ps.setLong(1, featureId);
            ps.setLong(2, squareId);
            ps.executeUpdate();
        }
    }

    public static void removeTile(Connection conn, long featureId, long squareId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_feature_tiles WHERE feature_id=? AND square_id=?")) {
            ps.setLong(1, featureId);
            ps.setLong(2, squareId);
            ps.executeUpdate();
        }
    }
}
