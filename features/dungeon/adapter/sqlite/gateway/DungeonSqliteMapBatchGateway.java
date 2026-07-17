package features.dungeon.adapter.sqlite.gateway;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;

public final class DungeonSqliteMapBatchGateway {

    private final DungeonSqliteConnectionSupport connectionSupport;

    public DungeonSqliteMapBatchGateway() {
        this(SqliteDatabase.defaultDatabase(
                DungeonPersistenceSchema.DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public DungeonSqliteMapBatchGateway(SqliteDatabase database) {
        DungeonSqliteSchemaManager schemaManager = new DungeonSqliteSchemaManager();
        this.connectionSupport = new DungeonSqliteConnectionSupport(
                Objects.requireNonNull(database, "database").connections(
                        "dungeon",
                        new SqliteMigration(1, schemaManager::ensureSchema),
                        new SqliteMigration(2, schemaManager::ensureSchema)));
    }

    DungeonSqliteMapBatchGateway(SqliteConnectionSource connections) {
        connectionSupport = new DungeonSqliteConnectionSupport(
                Objects.requireNonNull(connections, "connections"));
    }

    public List<DungeonMapRecord> saveMaps(List<DungeonMapRecord> records) {
        List<DungeonMapRecord> safeRecords = validRecords(records);
        if (safeRecords.isEmpty()) {
            return List.of();
        }
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return saveInSingleTransaction(connection, safeRecords);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save dungeon maps to SQLite.", exception);
        }
    }

    public DungeonMapRecord saveChange(DungeonMapRecord before, DungeonMapRecord after) {
        DungeonMapRecord safeBefore = Objects.requireNonNull(before, "before");
        DungeonMapRecord safeAfter = Objects.requireNonNull(after, "after");
        if (safeBefore.mapId() != safeAfter.mapId()) {
            throw new IllegalArgumentException("before and after must identify the same dungeon map");
        }
        try (Connection connection = connectionSupport.openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                DungeonSqliteMapRecordWriter.persistChange(connection, safeBefore, safeAfter);
                DungeonSqliteConnectionPersistence.persistChange(connection, safeBefore, safeAfter);
                DungeonSqliteTopologyElementGateway.persistChange(connection, safeBefore, safeAfter);
                connection.commit();
                return safeAfter;
            } catch (SQLException exception) {
                rollbackQuietly(connection);
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save dungeon map change to SQLite.", exception);
        }
    }

    private List<DungeonMapRecord> saveInSingleTransaction(
            Connection connection,
            List<DungeonMapRecord> records
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            persistRecords(connection, records);
            connection.commit();
            return List.copyOf(records);
        } catch (SQLException exception) {
            rollbackQuietly(connection);
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private static List<DungeonMapRecord> validRecords(List<DungeonMapRecord> records) {
        if (records == null || records.isEmpty()) {
            return List.of();
        }
        for (DungeonMapRecord record : records) {
            if (record == null) {
                throw new IllegalArgumentException("records must not contain null");
            }
        }
        return List.copyOf(records);
    }

    private static void persistRecords(
            Connection connection,
            List<DungeonMapRecord> records
    ) throws SQLException {
        for (DungeonMapRecord record : records) {
            DungeonSqliteMapRecordWriter.persist(connection, record);
            DungeonSqliteConnectionPersistence.persist(connection, record);
            DungeonSqliteTopologyElementGateway.persist(connection, record);
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
