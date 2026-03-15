package features.world.dungeonmap.repository.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonConceptLevelRepository {

    private DungeonConceptLevelRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonConceptLevel> getLevels(Connection conn, long mapId) throws SQLException {
        List<DungeonConceptLevel> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT concept_level_id, map_id, sort_order, start_level, end_level, progress_fraction, adventuring_days_target, entrance_count, exit_count "
                        + "FROM dungeon_concept_levels WHERE map_id=? ORDER BY sort_order, concept_level_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(map(rs));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonConceptLevel> findLevel(Connection conn, long conceptLevelId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT concept_level_id, map_id, sort_order, start_level, end_level, progress_fraction, adventuring_days_target, entrance_count, exit_count "
                        + "FROM dungeon_concept_levels WHERE concept_level_id=?")) {
            ps.setLong(1, conceptLevelId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(map(rs));
            }
        }
    }

    public static long insertLevel(Connection conn, DungeonConceptLevel level) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_concept_levels(map_id, sort_order, start_level, end_level, progress_fraction, adventuring_days_target, entrance_count, exit_count) "
                        + "VALUES(?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, level.mapId());
            ps.setInt(2, level.sortOrder());
            ps.setInt(3, level.startLevel());
            ps.setInt(4, level.endLevel());
            ps.setDouble(5, level.progressFraction());
            ps.setDouble(6, level.adventuringDaysTarget());
            ps.setInt(7, level.entranceCount());
            ps.setInt(8, level.exitCount());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) {
                    throw new SQLException("No generated key returned for dungeon_concept_levels insert");
                }
                return keys.getLong(1);
            }
        }
    }

    public static void updateLevel(Connection conn, DungeonConceptLevel level) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_concept_levels "
                        + "SET start_level=?, end_level=?, progress_fraction=?, adventuring_days_target=?, entrance_count=?, exit_count=? "
                        + "WHERE concept_level_id=?")) {
            ps.setInt(1, level.startLevel());
            ps.setInt(2, level.endLevel());
            ps.setDouble(3, level.progressFraction());
            ps.setDouble(4, level.adventuringDaysTarget());
            ps.setInt(5, level.entranceCount());
            ps.setInt(6, level.exitCount());
            ps.setLong(7, level.conceptLevelId());
            ps.executeUpdate();
        }
    }

    public static void deleteLevelsAfterSortOrder(Connection conn, long mapId, int maxSortOrder) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_concept_levels WHERE map_id=? AND sort_order>?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, maxSortOrder);
            ps.executeUpdate();
        }
    }

    private static DungeonConceptLevel map(ResultSet rs) throws SQLException {
        return new DungeonConceptLevel(
                rs.getLong("concept_level_id"),
                rs.getLong("map_id"),
                rs.getInt("sort_order"),
                rs.getInt("start_level"),
                rs.getInt("end_level"),
                rs.getDouble("progress_fraction"),
                rs.getDouble("adventuring_days_target"),
                rs.getInt("entrance_count"),
                rs.getInt("exit_count"));
    }
}
