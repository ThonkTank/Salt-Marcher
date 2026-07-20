package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import features.dungeon.application.authored.port.DungeonIdentityKind;
import platform.persistence.SqliteSchemaColumnSupport;

final class DungeonSqliteSchemaManager {

    static final int CANONICAL_SCHEMA_VERSION = 7;

    private static final List<String> REPLACED_DUNGEON_TABLES = List.of(
            DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE,
            DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE,
            DungeonPersistenceSchema.CORRIDOR_ROUTE_DEPENDENCIES_TABLE,
            DungeonPersistenceSchema.AUTHORED_LEVEL_BOUNDS_TABLE,
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

    static void ensureIdentitySequences(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_IDENTITY_SEQUENCES_TABLE_SQL);
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT OR IGNORE INTO " + DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE
                        + "(identity_kind, next_id) VALUES(?,1)")) {
            for (DungeonIdentityKind kind : DungeonIdentityKind.values()) {
                statement.setString(1, kind.name());
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    void replaceWithCanonicalSchema(Connection connection) throws SQLException {
        discardDungeonRows(connection);
        dropReplacedDungeonTables(connection);
        createCanonicalSchema(connection);
    }

    void addCorridorDoorLevel(Connection connection) throws SQLException {
        if (SqliteSchemaColumnSupport.hasColumn(
                connection,
                DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                "relative_cell_z")) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                    + " ADD COLUMN relative_cell_z INTEGER NOT NULL DEFAULT 0");
        }
    }

    void addCorridorRouteCellIndex(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_ROUTE_CELLS_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_CORRIDOR_ROUTE_CELLS_LOOKUP_INDEX_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOMS_CLUSTER_LOOKUP_INDEX_SQL);
        }
    }

    void addCorridorRouteDependencyIndex(Connection connection) throws SQLException {
        replaceWithCanonicalSchema(connection);
    }

    void repairVersionSixSchema(Connection connection) throws SQLException {
        boolean currentShape = SqliteSchemaColumnSupport.hasTable(
                connection, DungeonPersistenceSchema.AUTHORED_LEVEL_BOUNDS_TABLE)
                && SqliteSchemaColumnSupport.hasColumn(
                        connection, DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE, "minimum_q")
                && SqliteSchemaColumnSupport.hasColumn(
                        connection, DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE, "entity_chunk_count");
        if (currentShape) {
            return;
        }
        if (hasRows(connection, DungeonPersistenceSchema.MAPS_TABLE)
                || hasRows(connection, DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE)) {
            throw new SQLException("Unsupported populated Dungeon v6 schema.");
        }
        replaceWithCanonicalSchema(connection);
    }

    private static boolean hasRows(Connection connection, String table) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasTable(connection, table)) {
            return false;
        }
        try (Statement statement = connection.createStatement();
             var result = statement.executeQuery("SELECT 1 FROM " + table + " LIMIT 1")) {
            return result.next();
        }
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
        ensureIdentitySequences(connection);
    }
}
