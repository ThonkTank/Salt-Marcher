package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import platform.persistence.SqliteSchemaColumnSupport;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

final class DungeonSqliteSchemaManager {

    private static final DungeonSqliteTopologyBackfill TOPOLOGY_BACKFILL =
            new DungeonSqliteTopologyBackfill();
    private static final String TRANSITION_ANCHOR_TYPE_COLUMN = "anchor_type";
    private static final String TRANSITION_ANCHOR_EDGE_DIRECTION_COLUMN = "anchor_edge_direction";
    private static final String ADD_TRANSITION_ANCHOR_TYPE_COLUMN_SQL =
            "ALTER TABLE " + DungeonPersistenceSchema.TRANSITIONS_TABLE + " ADD COLUMN "
                    + TRANSITION_ANCHOR_TYPE_COLUMN + " TEXT";
    private static final String ADD_TRANSITION_ANCHOR_EDGE_DIRECTION_COLUMN_SQL =
            "ALTER TABLE " + DungeonPersistenceSchema.TRANSITIONS_TABLE + " ADD COLUMN "
                    + TRANSITION_ANCHOR_EDGE_DIRECTION_COLUMN + " TEXT";

    void ensureSchema(Connection connection) throws SQLException {
        boolean topologyTableExisted = SqliteSchemaColumnSupport.hasTable(
                connection,
                DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE);
        createTables(connection);
        ensureTransitionAnchorColumns(connection);
        TOPOLOGY_BACKFILL.apply(connection, topologyTableExisted);
    }

    private static void createTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_MAPS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOMS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDORS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_MEMBERS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTER_FLOOR_CELLS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTER_EDGES_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_FLOORS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_TOPOLOGY_ELEMENTS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_ANCHORS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_ANCHOR_REFS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_WAYPOINTS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_EXIT_DESCRIPTIONS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_STAIRS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_STAIR_PATH_NODES_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_STAIR_EXITS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_TRANSITIONS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_FEATURE_MARKERS_TABLE_SQL);
        }
    }

    private static void ensureTransitionAnchorColumns(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                TRANSITION_ANCHOR_TYPE_COLUMN)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute(ADD_TRANSITION_ANCHOR_TYPE_COLUMN_SQL);
            }
        }
        if (!SqliteSchemaColumnSupport.hasColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                TRANSITION_ANCHOR_EDGE_DIRECTION_COLUMN)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute(ADD_TRANSITION_ANCHOR_EDGE_DIRECTION_COLUMN_SQL);
            }
        }
    }
}
