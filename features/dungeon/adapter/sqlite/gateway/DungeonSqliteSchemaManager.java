package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import platform.persistence.SqliteSchemaColumnSupport;

final class DungeonSqliteSchemaManager {

    static final int CANONICAL_SCHEMA_VERSION = 5;

    private static final List<String> REPLACED_DUNGEON_TABLES = List.of(
            DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE,
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
        rebuildDerivedSpatialIndexes(connection);
    }

    private static void rebuildDerivedSpatialIndexes(Connection connection) throws SQLException {
        List<Long> mapIds = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT dungeon_map_id FROM " + DungeonPersistenceSchema.MAPS_TABLE
                        + " ORDER BY dungeon_map_id");
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                mapIds.add(rows.getLong("dungeon_map_id"));
            }
        }
        for (long mapId : mapIds) {
            DungeonSqliteChunkWriter.replaceChunkInventory(
                    connection,
                    DungeonSqliteConnectionSupport.findMap(connection, mapId)
                            .orElseThrow(() -> new SQLException("Missing Dungeon map during v5 index rebuild: " + mapId)));
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
    }
}
