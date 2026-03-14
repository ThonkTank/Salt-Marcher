package features.world.dungeonmap.repository.feature;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonFeatureRepository {

    private DungeonFeatureRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonFeature> getFeatures(Connection conn, long mapId) throws SQLException {
        List<DungeonFeature> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT feature_id, map_id, category, encounter_id, name, glance_description, detail_description, "
                        + "reactive_checks, gm_background, sort_order "
                        + "FROM dungeon_features WHERE map_id=? ORDER BY sort_order, category, feature_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapFeature(rs));
                }
            }
        }
        return result;
    }

    public static List<DungeonFeature> getFeaturesForCategory(Connection conn, long mapId, DungeonFeatureCategory category) throws SQLException {
        List<DungeonFeature> result = new ArrayList<>();
        DungeonFeatureCategory effectiveCategory = category == null ? DungeonFeatureCategory.CURIOSITY : category;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT feature_id, map_id, category, encounter_id, name, glance_description, detail_description, "
                        + "reactive_checks, gm_background, sort_order "
                        + "FROM dungeon_features WHERE map_id=? AND category=? ORDER BY sort_order, feature_id")) {
            ps.setLong(1, mapId);
            ps.setString(2, effectiveCategory.dbValue());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapFeature(rs));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonFeature> findFeature(Connection conn, long featureId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT feature_id, map_id, category, encounter_id, name, glance_description, detail_description, "
                        + "reactive_checks, gm_background, sort_order "
                        + "FROM dungeon_features WHERE feature_id=?")) {
            ps.setLong(1, featureId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(mapFeature(rs));
            }
        }
    }

    public static long upsertFeature(Connection conn, DungeonFeature feature) throws SQLException {
        DungeonFeatureCategory category = feature.category() == null ? DungeonFeatureCategory.CURIOSITY : feature.category();
        Long encounterId = category == DungeonFeatureCategory.ENCOUNTER ? feature.encounterId() : null;
        if (feature.featureId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_features(map_id, category, encounter_id, name, glance_description, detail_description, "
                            + "reactive_checks, gm_background, sort_order) VALUES(?,?,?,?,?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, feature.mapId());
                ps.setString(2, category.dbValue());
                if (encounterId != null) {
                    ps.setLong(3, encounterId);
                } else {
                    ps.setNull(3, java.sql.Types.INTEGER);
                }
                ps.setString(4, feature.name());
                ps.setString(5, feature.glanceDescription());
                ps.setString(6, feature.detailDescription());
                ps.setString(7, feature.reactiveChecks());
                ps.setString(8, feature.gmBackground());
                ps.setInt(9, feature.sortOrder());
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_features insert");
                    }
                    return keys.getLong(1);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_features SET category=?, encounter_id=?, name=?, glance_description=?, detail_description=?, "
                        + "reactive_checks=?, gm_background=?, sort_order=? WHERE feature_id=?")) {
            ps.setString(1, category.dbValue());
            if (encounterId != null) {
                ps.setLong(2, encounterId);
            } else {
                ps.setNull(2, java.sql.Types.INTEGER);
            }
            ps.setString(3, feature.name());
            ps.setString(4, feature.glanceDescription());
            ps.setString(5, feature.detailDescription());
            ps.setString(6, feature.reactiveChecks());
            ps.setString(7, feature.gmBackground());
            ps.setInt(8, feature.sortOrder());
            ps.setLong(9, feature.featureId());
            ps.executeUpdate();
            return feature.featureId();
        }
    }

    public static void deleteFeature(Connection conn, long featureId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_features WHERE feature_id=?")) {
            ps.setLong(1, featureId);
            ps.executeUpdate();
        }
    }

    public static void deleteEmptyFeatures(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_features "
                        + "WHERE map_id=? AND NOT EXISTS ("
                        + "  SELECT 1 FROM dungeon_feature_tiles t WHERE t.feature_id = dungeon_features.feature_id"
                        + ")")) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }

    private static DungeonFeature mapFeature(ResultSet rs) throws SQLException {
        return new DungeonFeature(
                rs.getLong("feature_id"),
                rs.getLong("map_id"),
                DungeonFeatureCategory.fromDbValue(rs.getString("category")),
                getNullableLong(rs, "encounter_id"),
                rs.getString("name"),
                rs.getString("glance_description"),
                rs.getString("detail_description"),
                rs.getString("reactive_checks"),
                rs.getString("gm_background"),
                rs.getInt("sort_order"));
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
