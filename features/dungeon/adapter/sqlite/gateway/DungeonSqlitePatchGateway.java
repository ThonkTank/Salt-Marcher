package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.api.DungeonChunkKey;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.Objects;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

/** Transaction owner for one revision-checked row-level Dungeon patch. */
public final class DungeonSqlitePatchGateway {

    private final SqliteConnectionSource connections;
    private final FailureHook failureHook;

    public DungeonSqlitePatchGateway() {
        this(SqliteDatabase.defaultDatabase(DungeonPersistenceSchema.DATABASE_FILE_NAME, NoopDiagnostics.INSTANCE));
    }

    public DungeonSqlitePatchGateway(SqliteDatabase database) {
        this(connections(database), FailureHook.NONE);
    }

    DungeonSqlitePatchGateway(SqliteDatabase database, FailureHook failureHook) {
        this(connections(database), failureHook);
    }

    DungeonSqlitePatchGateway(SqliteConnectionSource connections, FailureHook failureHook) {
        this.connections = Objects.requireNonNull(connections, "connections");
        this.failureHook = Objects.requireNonNull(failureHook, "failureHook");
    }

    public CommitOutcome commit(DungeonPatch patch) {
        DungeonPatch safePatch = Objects.requireNonNull(patch, "patch");
        validatePatch(safePatch);
        Connection connection = openConnection();
        Boolean previousAutoCommit = null;
        CommitOutcome outcome;
        try {
            previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            outcome = commitTransaction(connection, safePatch);
        } catch (SQLException | RuntimeException failure) {
            IllegalStateException reported = storageFailure(failure);
            rollback(connection, reported);
            cleanup(connection, previousAutoCommit, reported);
            throw reported;
        }
        if (outcome instanceof CommitOutcome.Committed) {
            cleanup(connection, previousAutoCommit, null);
            return outcome;
        }
        try {
            cleanupOrThrow(connection, previousAutoCommit);
            return outcome;
        } catch (SQLException | RuntimeException cleanupFailure) {
            IllegalStateException reported = storageFailure(cleanupFailure);
            rollback(connection, reported);
            cleanup(connection, null, reported);
            throw reported;
        }
    }

    private CommitOutcome commitTransaction(Connection connection, DungeonPatch patch) throws SQLException {
        CasResult current = currentRevision(connection, patch);
        if (current != CasResult.COMMITTED) {
            connection.rollback();
            return rejected(current);
        }
        DungeonSqlitePatchEntityWriter.validateStoredBeforeGraph(connection, patch);
        CasResult cas = compareAndSetRevision(connection, patch);
        if (cas != CasResult.COMMITTED) {
            connection.rollback();
            return rejected(cas);
        }
        failureHook.after(Phase.MAP_REVISION_CAS);
        DungeonSqlitePatchEntityWriter.apply(connection, patch);
        failureHook.after(Phase.AUTHORED_ROWS);
        Map<DungeonChunkKey, Long> chunks = DungeonSqlitePatchSpatialWriter.reconcile(connection, patch);
        failureHook.after(Phase.SPATIAL_ROWS);
        failureHook.after(Phase.BEFORE_COMMIT);
        CommitOutcome committed = new CommitOutcome.Committed(chunks);
        connection.commit();
        return committed;
    }

    private Connection openConnection() {
        try {
            return connections.openConnection();
        } catch (SQLException failure) {
            throw storageFailure(failure);
        }
    }

    private static CommitOutcome rejected(CasResult result) {
        return new CommitOutcome.Rejected(result == CasResult.MISSING
                ? DungeonUnitOfWorkResult.Reason.MAP_NOT_FOUND
                : DungeonUnitOfWorkResult.Reason.STALE_REVISION);
    }

    private static SqliteConnectionSource connections(SqliteDatabase database) {
        DungeonSqliteSchemaManager schema = new DungeonSqliteSchemaManager();
        return Objects.requireNonNull(database, "database").connections(
                "dungeon",
                new SqliteMigration(1, schema::ensureSchema),
                new SqliteMigration(2, schema::ensureSchema),
                new SqliteMigration(3, schema::replaceWithCanonicalSchema),
                new SqliteMigration(4, schema::addCorridorDoorLevel),
                new SqliteMigration(5, schema::addCorridorRouteCellIndex),
                new SqliteMigration(6, schema::addCorridorRouteDependencyIndex));
    }

    private static void validatePatch(DungeonPatch patch) {
        if (patch.mapId().value() <= 0L || patch.expectedRevision() < 1L
                || patch.committedRevision() != patch.expectedRevision() + 1L) {
            throw new IllegalArgumentException("patch map identity and revision transition must be valid");
        }
        patch.changes().forEach(change -> {
            if (!patch.mapId().equals(change.mapId())) {
                throw new IllegalArgumentException("every patch change must belong to the patch map");
            }
        });
        patch.touchedChunks().forEach(chunk -> {
            if (chunk.mapId() != patch.mapId().value()) {
                throw new IllegalArgumentException("every touched chunk must belong to the patch map");
            }
        });
    }

    private static CasResult compareAndSetRevision(Connection connection, DungeonPatch patch) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE dungeon_maps SET revision=? WHERE dungeon_map_id=? AND revision=?")) {
            statement.setLong(1, patch.committedRevision());
            statement.setLong(2, patch.mapId().value());
            statement.setLong(3, patch.expectedRevision());
            if (statement.executeUpdate() == 1) {
                return CasResult.COMMITTED;
            }
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM dungeon_maps WHERE dungeon_map_id=?")) {
            statement.setLong(1, patch.mapId().value());
            try (ResultSet rows = statement.executeQuery()) {
                return rows.next() ? CasResult.STALE : CasResult.MISSING;
            }
        }
    }

    private static CasResult currentRevision(Connection connection, DungeonPatch patch) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=?")) {
            statement.setLong(1, patch.mapId().value());
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return CasResult.MISSING;
                }
                return rows.getLong(1) == patch.expectedRevision() ? CasResult.COMMITTED : CasResult.STALE;
            }
        }
    }

    private static void rollback(Connection connection, Throwable original) {
        try {
            connection.rollback();
        } catch (SQLException | RuntimeException rollbackFailure) {
            original.addSuppressed(rollbackFailure);
        }
    }

    private static void cleanup(Connection connection, Boolean previousAutoCommit, Throwable original) {
        try {
            cleanupOrThrow(connection, previousAutoCommit);
        } catch (SQLException | RuntimeException cleanupFailure) {
            if (original != null) {
                original.addSuppressed(cleanupFailure);
            }
        }
    }

    private static void cleanupOrThrow(Connection connection, Boolean previousAutoCommit) throws SQLException {
        Throwable cleanupFailure = null;
        if (previousAutoCommit != null) {
            try {
                connection.setAutoCommit(previousAutoCommit);
            } catch (SQLException | RuntimeException failure) {
                cleanupFailure = failure;
            }
        }
        try {
            connection.close();
        } catch (SQLException | RuntimeException failure) {
            if (cleanupFailure == null) {
                cleanupFailure = failure;
            } else {
                cleanupFailure.addSuppressed(failure);
            }
        }
        if (cleanupFailure != null) {
            if (cleanupFailure instanceof SQLException sqlFailure) {
                throw sqlFailure;
            }
            throw (RuntimeException) cleanupFailure;
        }
    }

    private static IllegalStateException storageFailure(Throwable failure) {
        return failure instanceof IllegalStateException existing
                ? existing
                : new IllegalStateException("Failed to commit Dungeon patch to SQLite.", failure);
    }

    private enum CasResult { COMMITTED, MISSING, STALE }

    public sealed interface CommitOutcome permits CommitOutcome.Committed, CommitOutcome.Rejected {
        record Committed(Map<DungeonChunkKey, Long> chunkRevisions) implements CommitOutcome {
            public Committed { chunkRevisions = Map.copyOf(chunkRevisions); }
        }
        record Rejected(DungeonUnitOfWorkResult.Reason reason) implements CommitOutcome { }
    }

    enum Phase { MAP_REVISION_CAS, AUTHORED_ROWS, SPATIAL_ROWS, BEFORE_COMMIT }

    @FunctionalInterface
    interface FailureHook {
        FailureHook NONE = ignored -> { };
        void after(Phase phase) throws SQLException;
    }
}
