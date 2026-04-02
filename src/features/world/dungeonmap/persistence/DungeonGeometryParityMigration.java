package features.world.dungeonmap.persistence;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Statement;

/**
 * One-time migration from the legacy odd/odd persisted x2 coding to canonical raw 2x coordinates.
 */
public final class DungeonGeometryParityMigration {

    private DungeonGeometryParityMigration() {
        throw new AssertionError("No instances");
    }

    public static void migrateIfNeeded(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        if (!needsMigration(conn)) {
            return;
        }
        boolean previousAutoCommit = conn.getAutoCommit();
        Savepoint savepoint = null;
        if (previousAutoCommit) {
            conn.setAutoCommit(false);
        } else {
            savepoint = conn.setSavepoint("dungeon_geometry_parity");
        }
        try (Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(
                    "UPDATE dungeon_room_levels SET anchor_x2 = anchor_x2 - 1, anchor_y2 = anchor_y2 - 1");
            stmt.executeUpdate(
                    "UPDATE dungeon_room_level_seeds SET seed_x2 = seed_x2 - 1, seed_y2 = seed_y2 - 1");
            stmt.executeUpdate(
                    "UPDATE dungeon_room_level_segments"
                            + " SET start_x2 = start_x2 - 1, start_y2 = start_y2 - 1, end_x2 = end_x2 - 1, end_y2 = end_y2 - 1");
            stmt.executeUpdate(
                    "UPDATE dungeon_corridor_nodes SET grid_x2 = grid_x2 - 1, grid_y2 = grid_y2 - 1");
            if (previousAutoCommit) {
                conn.commit();
            } else if (savepoint != null) {
                conn.releaseSavepoint(savepoint);
            }
        } catch (SQLException | RuntimeException ex) {
            if (previousAutoCommit) {
                conn.rollback();
            } else if (savepoint != null) {
                conn.rollback(savepoint);
            }
            throw ex;
        } finally {
            if (previousAutoCommit) {
                conn.setAutoCommit(true);
            }
        }
    }

    private static boolean needsMigration(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_room_levels"
                        + " WHERE (anchor_x2 & 1) = 1 AND (anchor_y2 & 1) = 1"
                        + " LIMIT 1");
             ResultSet rs = ps.executeQuery()) {
            return rs.next();
        }
    }
}
