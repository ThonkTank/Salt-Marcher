package src.data.dungeon.gateway.local;

import org.jspecify.annotations.Nullable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonSqliteStatementSupport {

    private DungeonSqliteStatementSupport() {
    }

    static void deleteRowsNotIn(
            Connection connection,
            String tableName,
            String idColumn,
            String mapIdColumn,
            long mapId,
            Set<Long> retainedIds
    ) throws SQLException {
        StringBuilder sql = new StringBuilder("DELETE FROM ")
                .append(tableName)
                .append(" WHERE ")
                .append(mapIdColumn)
                .append("=?");
        if (retainedIds != null && !retainedIds.isEmpty()) {
            sql.append(" AND ")
                    .append(idColumn)
                    .append(" NOT IN (")
                    .append("?,".repeat(retainedIds.size()));
            sql.setLength(sql.length() - 1);
            sql.append(')');
        }
        try (PreparedStatement delete = connection.prepareStatement(sql.toString())) {
            delete.setLong(1, mapId);
            int index = 2;
            for (Long retainedId : retainedIds == null ? Set.<Long>of() : retainedIds) {
                delete.setLong(index++, retainedId);
            }
            delete.executeUpdate();
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
