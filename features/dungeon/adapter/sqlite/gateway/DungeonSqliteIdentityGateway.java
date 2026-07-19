package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.application.authored.port.DungeonIdentityKind;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Objects;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

/** Atomic technical range allocator with no placeholder authored rows. */
public final class DungeonSqliteIdentityGateway {
    private final DungeonSqliteConnectionSupport connectionSupport;
    private final DungeonSqliteSchemaManager schema = new DungeonSqliteSchemaManager();

    public DungeonSqliteIdentityGateway() {
        this(SqliteDatabase.defaultDatabase(
                DungeonPersistenceSchema.DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public DungeonSqliteIdentityGateway(SqliteDatabase database) {
        SqliteConnectionSource connections = Objects.requireNonNull(database, "database").connections(
                "dungeon",
                new SqliteMigration(1, schema::ensureSchema),
                new SqliteMigration(2, schema::ensureSchema),
                new SqliteMigration(3, schema::replaceWithCanonicalSchema),
                new SqliteMigration(4, schema::addCorridorDoorLevel),
                new SqliteMigration(5, schema::addCorridorRouteCellIndex),
                new SqliteMigration(6, schema::addCorridorRouteDependencyIndex));
        connectionSupport = new DungeonSqliteConnectionSupport(connections);
    }

    public DungeonIdentityRange reserve(DungeonIdentityKind kind, int count) {
        DungeonIdentityKind safeKind = Objects.requireNonNull(kind, "kind");
        if (count < 1) {
            throw new IllegalArgumentException("count must be positive");
        }
        try (Connection connection = connectionSupport.openReadyConnection()) {
            DungeonSqliteSchemaManager.ensureIdentitySequences(connection);
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                long first = current(connection, safeKind);
                long next = Math.addExact(first, count);
                try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE " + DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE
                                + " SET next_id=? WHERE identity_kind=? AND next_id=?")) {
                    update.setLong(1, next);
                    update.setString(2, safeKind.name());
                    update.setLong(3, first);
                    if (update.executeUpdate() != 1) {
                        throw new SQLException("Dungeon identity sequence changed concurrently");
                    }
                }
                connection.commit();
                return new DungeonIdentityRange(first, count);
            } catch (SQLException | RuntimeException failure) {
                rollback(connection, failure);
                throw failure;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to reserve Dungeon identity range from SQLite.", exception);
        }
    }

    private static long current(Connection connection, DungeonIdentityKind kind) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT next_id FROM " + DungeonPersistenceSchema.IDENTITY_SEQUENCES_TABLE
                        + " WHERE identity_kind=?")) {
            statement.setString(1, kind.name());
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next() || rows.getLong(1) < 1L) {
                    throw new SQLException("Missing Dungeon identity sequence: " + kind);
                }
                return rows.getLong(1);
            }
        }
    }

    private static void rollback(Connection connection, Throwable original) throws SQLException {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            original.addSuppressed(rollbackFailure);
            throw rollbackFailure;
        }
    }
}
