package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteSchemaManager {

    void ensureSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
        }
        boolean roomClusterColumnsAdded = ensureRoomClusterCompatibilityColumns(connection);
        boolean transitionColumnsAdded = ensureTransitionCompatibilityColumns(connection);
        ensureGeneralCompatibilityColumns(connection);
        if (roomClusterColumnsAdded) {
            backfillLegacyRoomClusterCenters(connection);
        }
        if (transitionColumnsAdded) {
            backfillLegacyTransitionAnchors(connection);
        }
    }

    private static void ensureGeneralCompatibilityColumns(Connection connection) throws SQLException {
        ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOMS_TABLE,
                "visual_description",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOMS_VISUAL_DESCRIPTION_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "shape",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_SHAPE_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "direction",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_DIRECTION_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "dimension1",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_DIMENSION1_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "dimension2",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_DIMENSION2_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "corridor_id",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_CORRIDOR_ID_COLUMN_SQL);
    }

    private static boolean ensureRoomClusterCompatibilityColumns(Connection connection) throws SQLException {
        boolean added = false;
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "center_x",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTERS_CENTER_X_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "center_y",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTERS_CENTER_Y_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "level_z",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTERS_LEVEL_Z_COLUMN_SQL);
        return added;
    }

    private static boolean ensureTransitionCompatibilityColumns(Connection connection) throws SQLException {
        boolean added = false;
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                "cell_x",
                DungeonPersistenceSchema.ADD_DUNGEON_TRANSITIONS_CELL_X_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                "cell_y",
                DungeonPersistenceSchema.ADD_DUNGEON_TRANSITIONS_CELL_Y_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                "level_z",
                DungeonPersistenceSchema.ADD_DUNGEON_TRANSITIONS_LEVEL_Z_COLUMN_SQL);
        return added;
    }

    private static boolean ensureColumn(
            Connection connection,
            String tableName,
            String columnName,
            String alterTableSql
    ) throws SQLException {
        if (SqliteSchemaColumnSupport.hasColumn(connection, tableName, columnName)) {
            return false;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute(alterTableSql);
        }
        return true;
    }

    private static void backfillLegacyRoomClusterCenters(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasTable(connection, DungeonPersistenceSchema.LEGACY_STRUCTURE_LEVELS_TABLE)
                || !SqliteSchemaColumnSupport.hasColumn(
                        connection,
                        DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                        "structure_object_id")) {
            return;
        }
        String roomClusters = DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE;
        String structureLevels = DungeonPersistenceSchema.LEGACY_STRUCTURE_LEVELS_TABLE;
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "UPDATE " + roomClusters
                            + " SET center_x = COALESCE(("
                            + "SELECT CAST(anchor_x2 / 2 AS INTEGER) FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id"
                            + " ORDER BY level_z LIMIT 1), center_x),"
                            + " center_y = COALESCE(("
                            + "SELECT CAST(anchor_y2 / 2 AS INTEGER) FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id"
                            + " ORDER BY level_z LIMIT 1), center_y),"
                            + " level_z = COALESCE(("
                            + "SELECT level_z FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id"
                            + " ORDER BY level_z LIMIT 1), level_z)"
                            + " WHERE EXISTS (SELECT 1 FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id)");
        }
    }

    private static void backfillLegacyTransitionAnchors(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_cell_x")
                || !SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_cell_y")
                || !SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_level_z")) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "UPDATE " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                            + " SET cell_x = COALESCE(cell_x, stair_anchor_cell_x),"
                            + " cell_y = COALESCE(cell_y, stair_anchor_cell_y),"
                            + " level_z = COALESCE(level_z, stair_anchor_level_z)"
                            + " WHERE stair_anchor_cell_x IS NOT NULL");
        }
    }
}
