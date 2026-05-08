package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteCompatibilityUpgrade {

    private static final String SQL_FROM = " FROM ";
    private static final String SQL_UPDATE = "UPDATE ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String STRUCTURE_OBJECT_ID_REFERENCE = ".structure_object_id = ";
    private static final String COLUMN_LEVEL_Z = "level_z";
    private static final DungeonSqliteCompatibilityColumns COMPATIBILITY_COLUMNS =
            new DungeonSqliteCompatibilityColumns();

    void apply(Connection connection) throws SQLException {
        DungeonSqliteCompatibilityColumns.CompatibilityState state = COMPATIBILITY_COLUMNS.ensure(connection);
        if (state.roomClusterColumnsAdded() || hasLegacyRoomClusterStructureObjectColumn(connection)) {
            backfillLegacyRoomClusterCenters(connection);
        }
        removeLegacyRoomClusterStructureObjectColumn(connection);
        if (state.transitionColumnsAdded()) {
            backfillLegacyTransitionAnchors(connection);
        }
    }

    private static void backfillLegacyRoomClusterCenters(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasTable(connection, DungeonPersistenceSchema.LEGACY_STRUCTURE_LEVELS_TABLE)
                || !hasLegacyRoomClusterStructureObjectColumn(connection)) {
            return;
        }
        String roomClusters = DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE;
        String structureLevels = DungeonPersistenceSchema.LEGACY_STRUCTURE_LEVELS_TABLE;
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    SQL_UPDATE + roomClusters
                            + " SET center_x = COALESCE(("
                            + "SELECT CAST(anchor_x2 / 2 AS INTEGER)" + SQL_FROM + structureLevels
                            + SQL_WHERE + structureLevels + STRUCTURE_OBJECT_ID_REFERENCE
                            + roomClusters + STRUCTURE_OBJECT_ID_REFERENCE
                            + " ORDER BY level_z LIMIT 1), center_x),"
                            + " center_y = COALESCE(("
                            + "SELECT CAST(anchor_y2 / 2 AS INTEGER)" + SQL_FROM + structureLevels
                            + SQL_WHERE + structureLevels + STRUCTURE_OBJECT_ID_REFERENCE
                            + roomClusters + STRUCTURE_OBJECT_ID_REFERENCE
                            + " ORDER BY level_z LIMIT 1), center_y),"
                            + " level_z = COALESCE(("
                            + "SELECT " + COLUMN_LEVEL_Z + SQL_FROM + structureLevels
                            + SQL_WHERE + structureLevels + STRUCTURE_OBJECT_ID_REFERENCE
                            + roomClusters + STRUCTURE_OBJECT_ID_REFERENCE
                            + " ORDER BY " + COLUMN_LEVEL_Z + " LIMIT 1), " + COLUMN_LEVEL_Z + ")"
                            + " WHERE EXISTS (SELECT 1" + SQL_FROM + structureLevels
                            + SQL_WHERE + structureLevels + STRUCTURE_OBJECT_ID_REFERENCE
                            + roomClusters + STRUCTURE_OBJECT_ID_REFERENCE + ")");
        }
    }

    private static boolean hasLegacyRoomClusterStructureObjectColumn(Connection connection) throws SQLException {
        return SqliteSchemaColumnSupport.hasColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "structure_object_id");
    }

    private static void removeLegacyRoomClusterStructureObjectColumn(Connection connection) throws SQLException {
        if (!hasLegacyRoomClusterStructureObjectColumn(connection)) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=OFF");
            statement.execute("PRAGMA legacy_alter_table=ON");
            statement.execute(DungeonPersistenceSchema.DROP_LEGACY_ROOM_CLUSTERS_STRUCTURE_OBJECT_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.RENAME_ROOM_CLUSTERS_TO_LEGACY_STRUCTURE_OBJECT_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL);
            statement.executeUpdate(DungeonPersistenceSchema.COPY_LEGACY_STRUCTURE_OBJECT_CLUSTERS_TO_ROOM_CLUSTERS_SQL);
            statement.execute(DungeonPersistenceSchema.DROP_LEGACY_ROOM_CLUSTERS_STRUCTURE_OBJECT_TABLE_SQL);
            statement.execute("PRAGMA legacy_alter_table=OFF");
            statement.execute("PRAGMA foreign_keys=ON");
        } catch (SQLException exception) {
            restorePragmas(connection);
            throw exception;
        }
    }

    private static void backfillLegacyTransitionAnchors(Connection connection) throws SQLException {
        if (!hasLegacyTransitionAnchorColumns(connection)) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    SQL_UPDATE + DungeonPersistenceSchema.TRANSITIONS_TABLE
                            + " SET cell_x = COALESCE(cell_x, stair_anchor_cell_x),"
                            + " cell_y = COALESCE(cell_y, stair_anchor_cell_y),"
                            + " level_z = COALESCE(level_z, stair_anchor_level_z)"
                            + " WHERE stair_anchor_cell_x IS NOT NULL");
        }
    }

    private static boolean hasLegacyTransitionAnchorColumns(Connection connection) throws SQLException {
        return SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_cell_x")
                && SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_cell_y")
                && SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_level_z");
    }

    private static void restorePragmas(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA legacy_alter_table=OFF");
            statement.execute("PRAGMA foreign_keys=ON");
        }
    }
}
