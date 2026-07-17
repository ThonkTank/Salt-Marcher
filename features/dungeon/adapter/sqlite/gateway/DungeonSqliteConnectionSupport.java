package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteConnectionSource;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

final class DungeonSqliteConnectionSupport {

    private static final String SELECT_MAP_COLUMNS = "SELECT dungeon_map_id, name, revision";
    private static final String SQL_FROM = " FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String WHERE_DUNGEON_MAP_ID = SQL_WHERE + "dungeon_map_id=?";

    private final SqliteConnectionSource connections;

    DungeonSqliteConnectionSupport(SqliteConnectionSource connections) {
        this.connections = Objects.requireNonNull(connections, "connections");
    }

    Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }

    static Optional<DungeonMapRecord> findMap(
            Connection connection,
            long mapId
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                SELECT_MAP_COLUMNS + SQL_FROM
                        + DungeonPersistenceSchema.MAPS_TABLE
                        + WHERE_DUNGEON_MAP_ID)) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return Optional.of(DungeonSqliteMapRecordLoader.load(connection, resultSet));
                }
                return Optional.empty();
            }
        }
    }
}
