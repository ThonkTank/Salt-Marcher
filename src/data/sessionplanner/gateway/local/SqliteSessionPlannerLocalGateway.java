package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;

public final class SqliteSessionPlannerLocalGateway {

    private final SessionPlannerSqliteConnectionFactory connectionFactory;
    private final SessionPlannerSchemaMigrator schemaMigrator;
    private final SessionPlanSqliteReads reads;
    private final SessionPlanSqliteWrites writes;

    public SqliteSessionPlannerLocalGateway() {
        this(
                new SessionPlannerSqliteConnectionFactory(),
                new SessionPlannerSchemaMigrator(),
                new SessionPlanSqliteReads(),
                new SessionPlanSqliteWrites());
    }

    SqliteSessionPlannerLocalGateway(
            SessionPlannerSqliteConnectionFactory connectionFactory,
            SessionPlannerSchemaMigrator schemaMigrator,
            SessionPlanSqliteReads reads,
            SessionPlanSqliteWrites writes
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
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

    public SessionPlanSnapshotRecord save(SessionPlanSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        try (Connection connection = openReadyConnection()) {
            return saveSnapshot(connection, snapshot);
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

    public void renameSession(long sessionId, String displayName) {
        try (Connection connection = openReadyConnection()) {
            writes.renameSession(connection, sessionId, displayName);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to rename session plan in SQLite.", exception);
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
        Connection connection = connectionFactory.openConnection();
        try {
            schemaMigrator.ensureSchema(connection);
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }

    private SessionPlanSnapshotRecord saveSnapshot(
            Connection connection,
            SessionPlanSnapshotRecord snapshot
    ) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            long sessionId = snapshot.plan().sessionId();
            writes.savePlan(connection, snapshot.plan());
            writes.replaceParticipants(connection, sessionId, snapshot.participants());
            writes.replaceEncounters(connection, sessionId, snapshot.encounters());
            writes.replaceRests(connection, sessionId, snapshot.rests());
            writes.replaceLootPlaceholders(connection, sessionId, snapshot.lootPlaceholders());
            connection.commit();
            Optional<SessionPlanSnapshotRecord> savedSession = reads.loadSession(connection, sessionId);
            if (savedSession.isEmpty()) {
                throw new IllegalStateException("Saved session plan vanished after save.");
            }
            return savedSession.get();
        } catch (SQLException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }
}
