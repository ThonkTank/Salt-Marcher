package features.dungeon.adapter.sqlite.gateway;

import platform.persistence.FeatureStoreHandle;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

final class DungeonSqliteConnectionSupport {

    private final FeatureStoreHandle connections;

    DungeonSqliteConnectionSupport(FeatureStoreHandle connections) {
        this.connections = Objects.requireNonNull(connections, "connections");
    }

    Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }
}
