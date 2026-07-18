package features.dungeon.adapter.sqlite.gateway;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

public final class DungeonSqliteGateway {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String SQL_FROM = " FROM ";
    private static final String SELECT_MAP_COLUMNS = "SELECT dungeon_map_id, name, revision";

    private final DungeonSqliteConnectionSupport connectionSupport;
    private final DungeonSqliteMapBatchGateway batchGateway;
    private final DungeonSqliteIdentityReservation identityReservation;

    public DungeonSqliteGateway() {
        this(SqliteDatabase.defaultDatabase(
                DungeonPersistenceSchema.DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public DungeonSqliteGateway(SqliteDatabase database) {
        DungeonSqliteSchemaManager schemaManager = new DungeonSqliteSchemaManager();
        SqliteConnectionSource connections = Objects.requireNonNull(database, "database").connections(
                "dungeon",
                new SqliteMigration(1, schemaManager::ensureSchema),
                new SqliteMigration(2, schemaManager::ensureSchema),
                new SqliteMigration(3, schemaManager::replaceWithCanonicalSchema),
                new SqliteMigration(4, schemaManager::addCorridorDoorLevel),
                new SqliteMigration(5, schemaManager::addCorridorRouteCellIndex));
        connectionSupport = new DungeonSqliteConnectionSupport(connections);
        batchGateway = new DungeonSqliteMapBatchGateway(connections);
        identityReservation = new DungeonSqliteIdentityReservation(connections);
    }

    public List<DungeonMapRecord> searchMapHeaders(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        try (Connection connection = connectionSupport.openReadyConnection();
            PreparedStatement statement = connection.prepareStatement(
                     SELECT_MAP_COLUMNS + SQL_FROM
                             + DungeonPersistenceSchema.MAPS_TABLE
                             + " ORDER BY name COLLATE NOCASE, dungeon_map_id")) {
            List<DungeonMapRecord> records = new ArrayList<>();
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    DungeonMapRecord record = new DungeonMapRecord(
                            resultSet.getLong("dungeon_map_id"),
                            resultSet.getString("name"),
                            resultSet.getLong("revision"),
                            null);
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
        try (Connection connection = connectionSupport.openReadyConnection();
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
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteConnectionSupport.findMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load dungeon map from SQLite.", exception);
        }
    }

    public DungeonMapRecord createMapHeader(String mapName) {
        String safeName = requireMapName(mapName);
        try (Connection connection = connectionSupport.openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     INSERT_INTO + DungeonPersistenceSchema.MAPS_TABLE
                             + "(name, revision) VALUES(?,1)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, safeName);
            statement.executeUpdate();
            try (ResultSet resultSet = statement.getGeneratedKeys()) {
                if (!resultSet.next()) {
                    throw new IllegalStateException("No key returned for Dungeon map insert");
                }
                return new DungeonMapRecord(resultSet.getLong(1), safeName, 1L, null);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to create Dungeon map header in SQLite.", exception);
        }
    }

    public DungeonMapRecord renameMapHeader(long mapId, String mapName) {
        String safeName = requireMapName(mapName);
        try (Connection connection = connectionSupport.openReadyConnection();
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE " + DungeonPersistenceSchema.MAPS_TABLE
                             + " SET name=?, revision=revision+1 WHERE dungeon_map_id=?")) {
            update.setString(1, safeName);
            update.setLong(2, mapId);
            if (update.executeUpdate() == 0) {
                throw new IllegalArgumentException("Unknown Dungeon map: " + mapId);
            }
            return mapHeader(connection, mapId).orElseThrow(() ->
                    new IllegalStateException("Renamed Dungeon map header is missing: " + mapId));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to rename Dungeon map header in SQLite.", exception);
        }
    }

    public DungeonMapRecord saveMap(DungeonMapRecord record) {
        if (record == null) {
            throw new IllegalArgumentException("record must not be null");
        }
        List<DungeonMapRecord> savedRecords = batchGateway.saveMaps(List.of(record));
        return savedRecords.isEmpty() ? record : savedRecords.get(0);
    }

    public List<DungeonMapRecord> saveMaps(List<DungeonMapRecord> records) {
        return batchGateway.saveMaps(records);
    }

    public DungeonMapRecord saveChange(DungeonMapRecord before, DungeonMapRecord after) {
        return batchGateway.saveChange(before, after);
    }

    public void deleteMap(long mapId) {
        try (Connection connection = connectionSupport.openReadyConnection()) {
            DungeonSqliteMapRecordWriter.deleteMap(connection, mapId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete dungeon map from SQLite.", exception);
        }
    }

    public long nextStairId() {
        return identityReservation.nextStairId();
    }

    public long nextTransitionId() {
        return identityReservation.nextTransitionId();
    }

    private static Optional<DungeonMapRecord> mapHeader(Connection connection, long mapId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                SELECT_MAP_COLUMNS + SQL_FROM + DungeonPersistenceSchema.MAPS_TABLE
                        + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next()
                        ? Optional.of(new DungeonMapRecord(
                                resultSet.getLong("dungeon_map_id"),
                                resultSet.getString("name"),
                                resultSet.getLong("revision"),
                                null))
                        : Optional.empty();
            }
        }
    }

    private static String requireMapName(String mapName) {
        if (mapName == null || mapName.isBlank()) {
            throw new IllegalArgumentException("mapName must not be blank");
        }
        return mapName.trim();
    }

}
