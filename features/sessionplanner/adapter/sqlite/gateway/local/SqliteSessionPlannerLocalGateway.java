package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

public final class SqliteSessionPlannerLocalGateway {

    private final SqliteConnectionSource connections;
    private final SessionPlanSqliteReads reads;
    private final SessionPlanSqliteWrites writes;

    public SqliteSessionPlannerLocalGateway() {
        this(SqliteDatabase.defaultDatabase(
                SessionPlannerPersistenceSchema.DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public SqliteSessionPlannerLocalGateway(SqliteDatabase database) {
        this(database, new SessionPlanSqliteReads(), new SessionPlanSqliteWrites());
    }

    SqliteSessionPlannerLocalGateway(
            SqliteDatabase database,
            SessionPlanSqliteReads reads,
            SessionPlanSqliteWrites writes
    ) {
        SessionPlannerSchemaMigrator schemaMigrator = new SessionPlannerSchemaMigrator();
        this.connections = Objects.requireNonNull(database, "database").connections(
                "session-planner",
                new SqliteMigration(1, schemaMigrator::ensureSchema),
                new SqliteMigration(2, schemaMigrator::addGeneratedRewards),
                new SqliteMigration(3, schemaMigrator::addRevisionAndManualLootNotes));
        this.reads = Objects.requireNonNull(reads, "reads");
        this.writes = Objects.requireNonNull(writes, "writes");
    }

    public Optional<SessionPlanSnapshotRecord> loadCurrent() {
        try (Connection connection = openReadyConnection()) {
            return reads.loadCurrent(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load current session plan from SQLite.", exception);
        }
    }

    public Optional<SessionPlanSnapshotRecord> loadSession(long sessionId) {
        try (Connection connection = openReadyConnection()) {
            return reads.loadSession(connection, sessionId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load session plan from SQLite.", exception);
        }
    }

    public List<SessionPlanRecord> listSessions() {
        try (Connection connection = openReadyConnection()) {
            return reads.listSessions(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to list session plans from SQLite.", exception);
        }
    }

    public SaveOutcome insert(SessionPlanSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        try (Connection connection = openReadyConnection()) {
            return insertSnapshot(connection, snapshot);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save session plan to SQLite.", exception);
        }
    }

    public SaveOutcome save(SessionPlanSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        try (Connection connection = openReadyConnection()) {
            return updateSnapshot(connection, snapshot);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save session plan to SQLite.", exception);
        }
    }

    public long nextSessionId() {
        try (Connection connection = openReadyConnection()) {
            return reads.nextSessionId(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate next session id from SQLite.", exception);
        }
    }

    public void setCurrentSessionId(long sessionId) {
        try (Connection connection = openReadyConnection()) {
            writes.setCurrentSessionId(connection, sessionId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to update current session pointer in SQLite.", exception);
        }
    }

    public void deleteSession(long sessionId) {
        try (Connection connection = openReadyConnection()) {
            writes.deleteSession(connection, sessionId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to delete session plan from SQLite.", exception);
        }
    }

    private Connection openReadyConnection() throws SQLException {
        return connections.openConnection();
    }

    private SaveOutcome insertSnapshot(
            Connection connection,
            SessionPlanSnapshotRecord snapshot
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            long sessionId = snapshot.plan().sessionId();
            Optional<SessionPlanSnapshotRecord> existing = reads.loadSession(connection, sessionId);
            if (existing.isPresent()) {
                connection.rollback();
                return new SaveOutcome(SaveStatus.ALREADY_EXISTS, Optional.empty(),
                        Optional.of(existing.get().plan().revision()));
            }
            if (!writes.insertPlan(connection, snapshot.plan())) {
                connection.rollback();
                return new SaveOutcome(SaveStatus.ALREADY_EXISTS, Optional.empty(), Optional.empty());
            }
            replaceChildren(connection, sessionId, snapshot);
            connection.commit();
            return new SaveOutcome(SaveStatus.SUCCESS, requireSaved(connection, sessionId), Optional.of(1L));
        } catch (SQLException | RuntimeException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private SaveOutcome updateSnapshot(
            Connection connection,
            SessionPlanSnapshotRecord snapshot
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            long sessionId = snapshot.plan().sessionId();
            Optional<SessionPlanSnapshotRecord> existing = reads.loadSession(connection, sessionId);
            if (existing.isEmpty()) {
                connection.rollback();
                return new SaveOutcome(SaveStatus.NOT_FOUND, Optional.empty(), Optional.empty());
            }
            long currentRevision = existing.get().plan().revision();
            if (currentRevision != snapshot.plan().revision()) {
                connection.rollback();
                return new SaveOutcome(SaveStatus.STALE, Optional.empty(), Optional.of(currentRevision));
            }
            if (!writes.updatePlan(connection, snapshot.plan())) {
                connection.rollback();
                Optional<SessionPlanSnapshotRecord> raced = reads.loadSession(connection, sessionId);
                return new SaveOutcome(
                        raced.isEmpty() ? SaveStatus.NOT_FOUND : SaveStatus.STALE,
                        Optional.empty(),
                        raced.map(value -> value.plan().revision()));
            }
            replaceChildren(connection, sessionId, snapshot);
            connection.commit();
            Optional<SessionPlanSnapshotRecord> saved = requireSaved(connection, sessionId);
            return new SaveOutcome(SaveStatus.SUCCESS, saved,
                    saved.map(value -> value.plan().revision()));
        } catch (SQLException | RuntimeException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private void replaceChildren(
            Connection connection,
            long sessionId,
            SessionPlanSnapshotRecord snapshot
    ) throws SQLException {
        writes.replaceParticipants(connection, sessionId, snapshot.participants());
        writes.replaceEncounters(connection, sessionId, snapshot.encounters());
        writes.replaceRests(connection, sessionId, snapshot.rests());
        writes.replaceManualLootNotes(connection, sessionId, snapshot.manualLootNotes());
        writes.replaceGeneratedRewards(connection, sessionId, snapshot.generatedRewards());
    }

    private Optional<SessionPlanSnapshotRecord> requireSaved(Connection connection, long sessionId)
            throws SQLException {
        Optional<SessionPlanSnapshotRecord> saved = reads.loadSession(connection, sessionId);
        if (saved.isEmpty()) {
            throw new IllegalStateException("Saved session plan vanished after save.");
        }
        return saved;
    }

    public record SaveOutcome(
            SaveStatus status,
            Optional<SessionPlanSnapshotRecord> snapshot,
            Optional<Long> currentRevision
    ) {
    }

    public enum SaveStatus {
        SUCCESS,
        STALE,
        NOT_FOUND,
        ALREADY_EXISTS
    }
}
