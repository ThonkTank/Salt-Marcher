package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;

final class DungeonSqliteConnectionSupport {

    private static final String SELECT_MAP_COLUMNS = "SELECT dungeon_map_id, name";
    private static final String SQL_FROM = " FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String WHERE_DUNGEON_MAP_ID = SQL_WHERE + "dungeon_map_id=?";

    private final DungeonSqliteConnectionFactory connectionFactory;
    private final DungeonSqliteSchemaManager schemaManager;

    DungeonSqliteConnectionSupport(
            DungeonSqliteConnectionFactory connectionFactory,
            DungeonSqliteSchemaManager schemaManager
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaManager = Objects.requireNonNull(schemaManager, "schemaManager");
    }

    Connection openReadyConnection() throws SQLException {
        Connection connection = connectionFactory.openConnection();
        try {
            schemaManager.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
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
