package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

final class DungeonSqliteCompatibilityColumns {

    private static final String COLUMN_LEVEL_Z = "level_z";

    CompatibilityState ensure(Connection connection) throws SQLException {
        boolean roomClusterColumnsAdded = ensureRoomClusterCompatibilityColumns(connection);
        boolean transitionColumnsAdded = ensureTransitionCompatibilityColumns(connection);
        ensureGeneralCompatibilityColumns(connection);
        return new CompatibilityState(roomClusterColumnsAdded, transitionColumnsAdded);
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
        ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE,
                "topology_element_id",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTER_EDGES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                "topology_element_id",
                DungeonPersistenceSchema.ADD_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL);
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
                COLUMN_LEVEL_Z,
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
                COLUMN_LEVEL_Z,
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

    record CompatibilityState(boolean roomClusterColumnsAdded, boolean transitionColumnsAdded) {
    }
}
