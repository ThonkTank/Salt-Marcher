package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public final class DungeonSqliteGateway {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String SQL_FROM = " FROM ";
    private static final String SQL_WHERE = " WHERE ";
    private static final String SELECT_MAP_COLUMNS = "SELECT dungeon_map_id, name";
    private static final String WHERE_DUNGEON_MAP_ID = SQL_WHERE + "dungeon_map_id=?";

    private final DungeonSqliteConnectionFactory connectionFactory;
    private final DungeonSqliteSchemaManager schemaManager;

    public DungeonSqliteGateway() {
        this(new DungeonSqliteConnectionFactory(), new DungeonSqliteSchemaManager());
    }

    DungeonSqliteGateway(
            DungeonSqliteConnectionFactory connectionFactory,
            DungeonSqliteSchemaManager schemaManager
    ) {
        this.connectionFactory = connectionFactory;
        this.schemaManager = schemaManager;
    }

    public List<DungeonMapRecord> searchMaps(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY name COLLATE NOCASE, dungeon_map_id")) {
            List<DungeonMapRecord> records = new ArrayList<>();
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    DungeonMapRecord record = DungeonSqliteMapRecordLoader.load(connection, resultSet);
                    if (normalized.isBlank() || record.name().toLowerCase(Locale.ROOT).contains(normalized)) {
                        records.add(record);
                    }
                }
            }
            return List.copyOf(records);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to search dungeon maps from SQLite.", exception);
        }
    }

    public Optional<DungeonMapRecord> firstMap() {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY dungeon_map_id LIMIT 1")) {
            try (ResultSet resultSet = statement.executeQuery()) {
                if (resultSet.next()) {
                    return Optional.of(DungeonSqliteMapRecordLoader.load(connection, resultSet));
                }
                return Optional.empty();
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load first dungeon map from SQLite.", exception);
        }
    }

    public Optional<DungeonMapRecord> findMap(long mapId) {
        try (Connection connection = openReadyConnection()) {
            return findMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load dungeon map from SQLite.", exception);
        }
    }

    public DungeonMapRecord saveMap(DungeonMapRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("record must not be null");
        }
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                DungeonSqliteMapRecordWriter.persist(connection, record);
                DungeonSqliteConnectionPersistence.persist(connection, record);
                DungeonSqliteTopologyElementGateway.persist(connection, record);
                connection.commit();
                return findMap(connection, record.mapId()).orElse(record);
            } catch (SQLException exception) {
                rollbackQuietly(connection);
                throw new IllegalStateException("Failed to save dungeon map to SQLite.", exception);
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save dungeon map to SQLite.", exception);
        }
    }

    public void deleteMap(long mapId) {
        try (Connection connection = openReadyConnection()) {
            DungeonSqliteMapRecordWriter.deleteMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete dungeon map from SQLite.", exception);
        }
    }

    public long nextMapId() {
        try (Connection connection = openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE + "(name) VALUES(?)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, "Dungeon Map");
            statement.executeUpdate();
            try (ResultSet resultSet = statement.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException(
                            "No key returned for " + DungeonPersistenceSchema.MAPS_TABLE + " insert");
                }
                long mapId = resultSet.getLong(1);
                DungeonSqliteMapRecordWriter.deleteMap(connection, mapId);
                return mapId;
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate dungeon map identity from SQLite.", exception);
        }
    }

    private Optional<DungeonMapRecord> findMap(Connection connection, long mapId) throws SQLException {
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

    private Connection openReadyConnection() throws SQLException {
        Connection connection = connectionFactory.openConnection();
        try {
            schemaManager.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Preserve the original storage failure that triggered the rollback.
        }
    }
}
