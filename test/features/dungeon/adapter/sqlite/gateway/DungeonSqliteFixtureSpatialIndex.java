package features.dungeon.adapter.sqlite.gateway;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** Test-fixture bridge that rebuilds derived indexes without mutating authored rows or map revision. */
public final class DungeonSqliteFixtureSpatialIndex {

    private DungeonSqliteFixtureSpatialIndex() {
    }

    public static void rebuild(Path databasePath, long mapId) {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:sqlite:" + databasePath.toAbsolutePath())) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys=ON");
            }
            connection.setAutoCommit(false);
            if (hasPartialTransitionCoordinates(connection, mapId)) {
                connection.rollback();
                return;
            }
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT dungeon_map_id, name, revision FROM dungeon_maps WHERE dungeon_map_id=?")) {
                statement.setLong(1, mapId);
                try (ResultSet rows = statement.executeQuery()) {
                    if (!rows.next()) {
                        throw new IllegalArgumentException("Unknown Dungeon fixture map: " + mapId);
                    }
                    DungeonSqliteChunkWriter.replaceChunkInventory(
                            connection,
                            DungeonSqliteMapRecordLoader.load(connection, rows));
                }
            }
            connection.commit();
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to rebuild Dungeon fixture spatial indexes.", exception);
        }
    }

    private static boolean hasPartialTransitionCoordinates(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM dungeon_transitions WHERE dungeon_map_id=?"
                        + " AND ((cell_x IS NULL) + (cell_y IS NULL) + (level_z IS NULL)) NOT IN (0, 3)"
                        + " LIMIT 1")) {
            statement.setLong(1, mapId);
            try (ResultSet rows = statement.executeQuery()) {
                return rows.next();
            }
        }
    }
}
