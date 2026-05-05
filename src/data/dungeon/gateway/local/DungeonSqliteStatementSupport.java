package src.data.dungeon.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonSqliteStatementSupport {

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

    private DungeonSqliteStatementSupport() {
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
        createRetainedIdsTable(connection);
        clearRetainedIds(connection);
        try (PreparedStatement insert = connection.prepareStatement(INSERT_TEMP_RETAINED_ID_SQL)) {
            for (Long retainedId : retainedIds == null ? Set.<Long>of() : retainedIds) {
                insert.setLong(1, retainedId);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void createRetainedIdsTable(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(CREATE_TEMP_RETAINED_IDS_TABLE_SQL)) {
            statement.executeUpdate();
        }
    }

    private static void clearRetainedIds(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(CLEAR_TEMP_RETAINED_IDS_SQL)) {
            statement.executeUpdate();
        }
    }

    static void setNullableLong(PreparedStatement statement, int index, @Nullable Long value)
            throws SQLException {
        if (value == null || value <= 0L) {
            statement.setNull(index, java.sql.Types.INTEGER);
            return;
        }
        statement.setLong(index, value);
    }

    static void setNullableInteger(PreparedStatement statement, int index, @Nullable Integer value)
            throws SQLException {
        if (value == null) {
            statement.setNull(index, java.sql.Types.INTEGER);
            return;
        }
        statement.setInt(index, value);
    }

    static @Nullable Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    static @Nullable Integer nullableInteger(ResultSet resultSet, String column) throws SQLException {
        int value = resultSet.getInt(column);
        return resultSet.wasNull() ? null : value;
    }

    static <T> Map<Long, List<T>> copyGrouped(Map<Long, List<T>> records) {
        Map<Long, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<T>> entry : records.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
