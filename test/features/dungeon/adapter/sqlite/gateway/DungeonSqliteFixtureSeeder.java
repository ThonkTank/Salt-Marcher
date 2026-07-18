package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

/** Test-only full-record seed route for persistence fixtures. */
public final class DungeonSqliteFixtureSeeder {

    private DungeonSqliteFixtureSeeder() {
    }

    public static void seed(SqliteDatabase database, DungeonMapRecord record) {
        seed(database, List.of(Objects.requireNonNull(record, "record")));
    }

    public static void seed(SqliteDatabase database, List<DungeonMapRecord> records) {
        List<DungeonMapRecord> safeRecords = List.copyOf(Objects.requireNonNull(records, "records"));
        if (safeRecords.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("records must not contain null");
        }
        DungeonSqliteSchemaManager schemaManager = new DungeonSqliteSchemaManager();
        SqliteConnectionSource connections = Objects.requireNonNull(database, "database").connections(
                "dungeon",
                new SqliteMigration(1, schemaManager::ensureSchema),
                new SqliteMigration(2, schemaManager::ensureSchema),
                new SqliteMigration(3, schemaManager::replaceWithCanonicalSchema),
                new SqliteMigration(4, schemaManager::addCorridorDoorLevel),
                new SqliteMigration(5, schemaManager::addCorridorRouteCellIndex),
                new SqliteMigration(6, schemaManager::addCorridorRouteDependencyIndex));
        try (Connection connection = connections.openConnection()) {
            seed(connection, safeRecords);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to seed Dungeon SQLite fixture.", exception);
        }
    }

    private static void seed(Connection connection, List<DungeonMapRecord> records) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            for (DungeonMapRecord record : records) {
                DungeonSqliteMapRecordWriter.persist(connection, record);
                DungeonSqliteConnectionPersistence.persist(connection, record);
                DungeonSqliteFixtureTopologyWriter.persist(connection, record);
            }
            connection.commit();
        } catch (SQLException exception) {
            rollbackQuietly(connection);
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private static void rollbackQuietly(Connection connection) {
        try {
            connection.rollback();
        } catch (SQLException ignored) {
            // Preserve the original fixture failure.
        }
    }
}
