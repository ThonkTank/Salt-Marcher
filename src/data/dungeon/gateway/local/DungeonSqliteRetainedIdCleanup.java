package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Set;

final class DungeonSqliteRetainedIdCleanup {

    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String TEMP_RETAINED_IDS_TABLE = "sm_temp_retained_dungeon_ids";
    private static final String EMPTY_RETAINED_IDS_COUNT_SQL = "(SELECT COUNT(*) FROM ";
    private static final String EMPTY_RETAINED_IDS_SUFFIX_SQL = ") = 0 ";
    private static final String WHERE_DUNGEON_MAP_ID_AND_RETAINED_SQL = " WHERE dungeon_map_id=? AND (";
    private static final String CREATE_TEMP_RETAINED_IDS_TABLE_SQL =
            "CREATE TEMP TABLE IF NOT EXISTS " + TEMP_RETAINED_IDS_TABLE + "(id INTEGER PRIMARY KEY)";
    private static final String CLEAR_TEMP_RETAINED_IDS_SQL = DELETE_FROM + TEMP_RETAINED_IDS_TABLE;
    private static final String INSERT_TEMP_RETAINED_ID_SQL =
            "INSERT INTO " + TEMP_RETAINED_IDS_TABLE + "(id) VALUES (?)";
    private static final String DELETE_OBSOLETE_CORRIDORS_SQL =
            DELETE_FROM + DungeonPersistenceSchema.CORRIDORS_TABLE + WHERE_DUNGEON_MAP_ID_AND_RETAINED_SQL
                    + EMPTY_RETAINED_IDS_COUNT_SQL + TEMP_RETAINED_IDS_TABLE + EMPTY_RETAINED_IDS_SUFFIX_SQL
                    + "OR corridor_id NOT IN (SELECT id FROM " + TEMP_RETAINED_IDS_TABLE + "))";
    private static final String DELETE_OBSOLETE_STAIRS_SQL =
            DELETE_FROM + DungeonPersistenceSchema.STAIRS_TABLE + WHERE_DUNGEON_MAP_ID_AND_RETAINED_SQL
                    + EMPTY_RETAINED_IDS_COUNT_SQL + TEMP_RETAINED_IDS_TABLE + EMPTY_RETAINED_IDS_SUFFIX_SQL
                    + "OR stair_id NOT IN (SELECT id FROM " + TEMP_RETAINED_IDS_TABLE + "))";
    private static final String DELETE_OBSOLETE_TRANSITIONS_SQL =
            DELETE_FROM + DungeonPersistenceSchema.TRANSITIONS_TABLE + WHERE_DUNGEON_MAP_ID_AND_RETAINED_SQL
                    + EMPTY_RETAINED_IDS_COUNT_SQL + TEMP_RETAINED_IDS_TABLE + EMPTY_RETAINED_IDS_SUFFIX_SQL
                    + "OR transition_id NOT IN (SELECT id FROM " + TEMP_RETAINED_IDS_TABLE + "))";
    private static final String DELETE_OBSOLETE_ROOMS_SQL =
            DELETE_FROM + DungeonPersistenceSchema.ROOMS_TABLE + WHERE_DUNGEON_MAP_ID_AND_RETAINED_SQL
                    + EMPTY_RETAINED_IDS_COUNT_SQL + TEMP_RETAINED_IDS_TABLE + EMPTY_RETAINED_IDS_SUFFIX_SQL
                    + "OR room_id NOT IN (SELECT id FROM " + TEMP_RETAINED_IDS_TABLE + "))";
    private static final String DELETE_OBSOLETE_ROOM_CLUSTERS_SQL =
            DELETE_FROM + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + WHERE_DUNGEON_MAP_ID_AND_RETAINED_SQL
                    + EMPTY_RETAINED_IDS_COUNT_SQL + TEMP_RETAINED_IDS_TABLE + EMPTY_RETAINED_IDS_SUFFIX_SQL
                    + "OR cluster_id NOT IN (SELECT id FROM " + TEMP_RETAINED_IDS_TABLE + "))";

    private DungeonSqliteRetainedIdCleanup() {
    }

    static void deleteObsoleteCorridors(Connection connection, long mapId, Set<Long> retainedIds) throws SQLException {
        deleteObsoleteRecords(connection, mapId, retainedIds, DELETE_OBSOLETE_CORRIDORS_SQL);
    }

    static void deleteObsoleteStairs(Connection connection, long mapId, Set<Long> retainedIds) throws SQLException {
        deleteObsoleteRecords(connection, mapId, retainedIds, DELETE_OBSOLETE_STAIRS_SQL);
    }

    static void deleteObsoleteTransitions(Connection connection, long mapId, Set<Long> retainedIds) throws SQLException {
        deleteObsoleteRecords(connection, mapId, retainedIds, DELETE_OBSOLETE_TRANSITIONS_SQL);
    }

    static void deleteObsoleteRooms(Connection connection, long mapId, Set<Long> retainedIds) throws SQLException {
        deleteObsoleteRecords(connection, mapId, retainedIds, DELETE_OBSOLETE_ROOMS_SQL);
    }

    static void deleteObsoleteRoomClusters(Connection connection, long mapId, Set<Long> retainedIds) throws SQLException {
        deleteObsoleteRecords(connection, mapId, retainedIds, DELETE_OBSOLETE_ROOM_CLUSTERS_SQL);
    }

    private static void deleteObsoleteRecords(
            Connection connection,
            long mapId,
            Set<Long> retainedIds,
            String deleteSql
    ) throws SQLException {
        prepareRetainedIds(connection, retainedIds);
        try (PreparedStatement delete = connection.prepareStatement(deleteSql)) {
            delete.setLong(1, mapId);
            delete.executeUpdate();
        }
    }

    private static void prepareRetainedIds(Connection connection, Set<Long> retainedIds) throws SQLException {
        executeUpdate(connection, CREATE_TEMP_RETAINED_IDS_TABLE_SQL);
        executeUpdate(connection, CLEAR_TEMP_RETAINED_IDS_SQL);
        try (PreparedStatement insert = connection.prepareStatement(INSERT_TEMP_RETAINED_ID_SQL)) {
            for (Long retainedId : retainedIds) {
                insert.setLong(1, retainedId);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void executeUpdate(Connection connection, String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.executeUpdate();
        }
    }
}
