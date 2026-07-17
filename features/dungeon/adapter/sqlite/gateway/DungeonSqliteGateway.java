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
import java.util.LinkedHashSet;
import java.util.Set;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.api.DungeonViewportRequest;

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
                new SqliteMigration(2, schemaManager::ensureSchema));
        connectionSupport = new DungeonSqliteConnectionSupport(connections);
        batchGateway = new DungeonSqliteMapBatchGateway(connections);
        identityReservation = new DungeonSqliteIdentityReservation(connections);
    }

    public List<DungeonMapRecord> searchMaps(String query) {
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

    public Set<DungeonChunkKey> findAvailableChunks(DungeonViewportRequest request) {
        if (request == null) {
            return Set.of();
        }
        Set<DungeonChunkKey> requested = request.loadingChunks();
        if (requested.isEmpty()) {
            return Set.of();
        }
        int minimumChunkQ = requested.stream().mapToInt(DungeonChunkKey::chunkQ).min().orElse(0);
        int maximumChunkQ = requested.stream().mapToInt(DungeonChunkKey::chunkQ).max().orElse(0);
        int minimumChunkR = requested.stream().mapToInt(DungeonChunkKey::chunkR).min().orElse(0);
        int maximumChunkR = requested.stream().mapToInt(DungeonChunkKey::chunkR).max().orElse(0);
        try (Connection connection = connectionSupport.openReadyConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT level_z, chunk_q, chunk_r FROM " + DungeonPersistenceSchema.CHUNKS_TABLE
                             + " WHERE dungeon_map_id=? AND level_z=?"
                             + " AND chunk_q BETWEEN ? AND ? AND chunk_r BETWEEN ? AND ?"
                             + " ORDER BY chunk_r, chunk_q")) {
            statement.setLong(1, request.mapId());
            statement.setInt(2, request.level());
            statement.setInt(3, minimumChunkQ);
            statement.setInt(4, maximumChunkQ);
            statement.setInt(5, minimumChunkR);
            statement.setInt(6, maximumChunkR);
            Set<DungeonChunkKey> available = new LinkedHashSet<>();
            try (ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    available.add(new DungeonChunkKey(
                            request.mapId(),
                            resultSet.getInt("level_z"),
                            resultSet.getInt("chunk_q"),
                            resultSet.getInt("chunk_r")));
                }
            }
            return Set.copyOf(available);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load dungeon chunk inventory from SQLite.", exception);
        }
    }

    public long nextMapId() {
        try (Connection connection = connectionSupport.openReadyConnection();
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

    public long nextStairId() {
        return identityReservation.nextStairId();
    }

    public long nextTransitionId() {
        return identityReservation.nextTransitionId();
    }

}
