package src.data.creatures.gateway.local;

import org.jspecify.annotations.Nullable;

import java.sql.ResultSet;
import java.sql.SQLException;

final class CreaturesSqliteQuerySupport {

    private CreaturesSqliteQuerySupport() {
    }

    static @Nullable Integer getNullableInt(ResultSet resultSet, String columnName) throws SQLException {
        int value = resultSet.getInt(columnName);
        return resultSet.wasNull() ? null : value;
    }
}
