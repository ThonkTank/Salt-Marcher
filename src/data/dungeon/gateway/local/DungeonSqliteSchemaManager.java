package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;

final class DungeonSqliteSchemaManager {

    private static final DungeonSqliteCompatibilityUpgrade COMPATIBILITY_UPGRADE =
            new DungeonSqliteCompatibilityUpgrade();
    private static final DungeonSqliteTopologyBackfill TOPOLOGY_BACKFILL =
            new DungeonSqliteTopologyBackfill();

    void ensureSchema(Connection connection) throws SQLException {
        boolean topologyTableExisted = SqliteSchemaColumnSupport.hasTable(
                connection,
                DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE);
        createTables(connection);
        COMPATIBILITY_UPGRADE.apply(connection);
        TOPOLOGY_BACKFILL.apply(connection, topologyTableExisted);
    }

    private static void createTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_MAPS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOMS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDORS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_MEMBERS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTER_VERTICES_TABLE_SQL);
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
        }
    }
}
