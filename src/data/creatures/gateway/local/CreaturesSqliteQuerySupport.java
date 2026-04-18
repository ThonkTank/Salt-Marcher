package src.data.creatures.gateway.local;

import org.jspecify.annotations.Nullable;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

final class CreaturesSqliteQuerySupport {

    private CreaturesSqliteQuerySupport() {
    }

    static @Nullable Integer getNullableInt(ResultSet resultSet, String columnName) throws SQLException {
        int value = resultSet.getInt(columnName);
        return resultSet.wasNull() ? null : value;
    }

    static void bindParams(PreparedStatement statement, List<Object> params) throws SQLException {
        int index = 1;
        for (Object param : params) {
            if (param instanceof String text) {
                statement.setString(index++, text);
            } else if (param instanceof Integer number) {
                statement.setInt(index++, number);
            } else {
                throw new IllegalArgumentException("Unsupported SQL parameter type: " + param.getClass().getName());
            }
        }
    }
}
