package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import platform.persistence.SqliteConnectionSource;

final class DungeonSqliteConnectionSupport {

    private final SqliteConnectionSource connections;

    DungeonSqliteConnectionSupport(SqliteConnectionSource connections) {
        this.connections = Objects.requireNonNull(connections, "connections");
    }

    Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
