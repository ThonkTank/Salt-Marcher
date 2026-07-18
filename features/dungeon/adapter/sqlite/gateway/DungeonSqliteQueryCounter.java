package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/** Per-read statement counter used by local diagnostics and bounded-cost proof. */
final class DungeonSqliteQueryCounter {
    private int statements;
    private final List<String> preparedSql = new ArrayList<>();

    PreparedStatement prepare(Connection connection, String sql) throws SQLException {
        statements++;
        preparedSql.add(sql);
        return connection.prepareStatement(sql);
    }

    int statements() {
        return statements;
    }

    List<String> preparedSql() {
        return List.copyOf(preparedSql);
    }
}
