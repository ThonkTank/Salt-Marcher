package src.data.dungeon.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.data.dungeon.model.DungeonMapRecord;

public final class DungeonSqliteMapBatchGateway {

    private final DungeonSqliteConnectionSupport connectionSupport;

    public DungeonSqliteMapBatchGateway() {
        this(new DungeonSqliteConnectionFactory(), new DungeonSqliteSchemaManager());
    }

    DungeonSqliteMapBatchGateway(
            DungeonSqliteConnectionFactory connectionFactory,
            DungeonSqliteSchemaManager schemaManager
    ) {
        connectionSupport = new DungeonSqliteConnectionSupport(
                Objects.requireNonNull(connectionFactory, "connectionFactory"),
                Objects.requireNonNull(schemaManager, "schemaManager"));
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

    private List<DungeonMapRecord> saveInSingleTransaction(
            Connection connection,
            List<DungeonMapRecord> records
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            persistRecords(connection, records);
            List<DungeonMapRecord> savedRecords = loadSavedRecords(connection, records);
            connection.commit();
            return List.copyOf(savedRecords);
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

    private static List<DungeonMapRecord> loadSavedRecords(
            Connection connection,
            List<DungeonMapRecord> records
    ) throws SQLException {
        List<DungeonMapRecord> savedRecords = new ArrayList<>();
        for (DungeonMapRecord record : records) {
            savedRecords.add(DungeonSqliteConnectionSupport.findMap(connection, record.mapId()).orElse(record));
        }
        return savedRecords;
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Preserve the original storage failure that triggered the rollback.
        }
    }
}
