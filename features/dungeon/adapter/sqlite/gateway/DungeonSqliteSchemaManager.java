package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import platform.persistence.SqliteSchemaColumnSupport;

final class DungeonSqliteSchemaManager {

    static final int CANONICAL_SCHEMA_VERSION = 3;

    private static final List<String> REPLACED_DUNGEON_TABLES = List.of(
            DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE,
            DungeonPersistenceSchema.CHUNKS_TABLE,
            DungeonPersistenceSchema.CORRIDOR_ANCHOR_REFS_TABLE,
            DungeonPersistenceSchema.CORRIDOR_ANCHORS_TABLE,
            DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
            DungeonPersistenceSchema.CORRIDOR_WAYPOINTS_TABLE,
            DungeonPersistenceSchema.CORRIDOR_MEMBERS_TABLE,
            DungeonPersistenceSchema.STAIR_EXITS_TABLE,
            DungeonPersistenceSchema.STAIR_PATH_NODES_TABLE,
            DungeonPersistenceSchema.TRANSITIONS_TABLE,
            DungeonPersistenceSchema.FEATURE_MARKERS_TABLE,
            DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE,
            DungeonPersistenceSchema.ROOM_CELLS_TABLE,
            "dungeon_room_floors",
            "dungeon_room_cluster_vertices",
            DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE,
            "dungeon_room_cluster_floor_cells",
            DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE,
            DungeonPersistenceSchema.STAIRS_TABLE,
            DungeonPersistenceSchema.CORRIDORS_TABLE,
            DungeonPersistenceSchema.ROOMS_TABLE,
            DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
            DungeonPersistenceSchema.MAPS_TABLE);

    void ensureSchema(Connection connection) throws SQLException {
        createCanonicalSchema(connection);
    }

    void replaceWithCanonicalSchema(Connection connection) throws SQLException {
        discardDungeonRows(connection);
        dropReplacedDungeonTables(connection);
        createCanonicalSchema(connection);
    }

    private static void discardDungeonRows(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasTable(connection, DungeonPersistenceSchema.MAPS_TABLE)) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM " + DungeonPersistenceSchema.MAPS_TABLE);
        }
    }

    private static void dropReplacedDungeonTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String table : REPLACED_DUNGEON_TABLES) {
                statement.execute("DROP TABLE IF EXISTS " + table);
            }
        }
    }

    private static void createCanonicalSchema(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
            for (String createIndexSql : DungeonPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(createIndexSql);
            }
        }
    }
}
