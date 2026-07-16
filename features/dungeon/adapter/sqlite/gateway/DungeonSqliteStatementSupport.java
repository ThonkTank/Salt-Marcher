package features.dungeon.adapter.sqlite.gateway;

import org.jspecify.annotations.Nullable;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonSqliteStatementSupport {

    private DungeonSqliteStatementSupport() {
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
