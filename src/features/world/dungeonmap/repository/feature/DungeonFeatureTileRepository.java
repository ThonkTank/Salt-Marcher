package features.world.dungeonmap.repository.feature;

import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;

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

    public static List<DungeonFeatureTile> getTilesForCategory(Connection conn, long mapId, DungeonFeatureCategory category) throws SQLException {
        List<DungeonFeatureTile> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT t.feature_id, t.square_id, s.x, s.y "
                        + "FROM dungeon_feature_tiles t "
                        + "JOIN dungeon_features f ON f.feature_id = t.feature_id "
                        + "JOIN dungeon_squares s ON s.square_id = t.square_id "
                        + "WHERE f.map_id=? AND f.category=? ORDER BY t.feature_id, s.y, s.x")) {
            ps.setLong(1, mapId);
            ps.setString(2, (category == null ? DungeonFeatureCategory.CURIOSITY : category).dbValue());
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

    public static void moveTiles(Connection conn, long fromFeatureId, long targetFeatureId) throws SQLException {
        if (fromFeatureId == targetFeatureId) {
            return;
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT OR IGNORE INTO dungeon_feature_tiles(feature_id, square_id) "
                        + "SELECT ?, square_id FROM dungeon_feature_tiles WHERE feature_id=?");
             PreparedStatement delete = conn.prepareStatement(
                     "DELETE FROM dungeon_feature_tiles WHERE feature_id=?")) {
            insert.setLong(1, targetFeatureId);
            insert.setLong(2, fromFeatureId);
            insert.executeUpdate();
            delete.setLong(1, fromFeatureId);
            delete.executeUpdate();
        }
    }

    public static void reassignTile(Connection conn, long squareId, long fromFeatureId, long targetFeatureId) throws SQLException {
        if (fromFeatureId == targetFeatureId) {
            return;
        }
        addTile(conn, targetFeatureId, squareId);
        removeTile(conn, fromFeatureId, squareId);
    }
}
