package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;
import java.util.Optional;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;

public final class SqliteSessionPlannerLocalGateway {

    private final SessionPlannerSqliteConnectionFactory connectionFactory;
    private final SessionPlannerSchemaMigrator schemaMigrator;
    private final SessionPlanSqliteStore store;

    public SqliteSessionPlannerLocalGateway() {
        this(
                new SessionPlannerSqliteConnectionFactory(),
                new SessionPlannerSchemaMigrator(),
                new SessionPlanSqliteStore());
    }

    SqliteSessionPlannerLocalGateway(
            SessionPlannerSqliteConnectionFactory connectionFactory,
            SessionPlannerSchemaMigrator schemaMigrator,
            SessionPlanSqliteStore store
    ) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.schemaMigrator = Objects.requireNonNull(schemaMigrator, "schemaMigrator");
        this.store = Objects.requireNonNull(store, "store");
    }

    public Optional<SessionPlanSnapshotRecord> loadCurrent() {
        try (Connection connection = openReadyConnection()) {
            return store.loadCurrent(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load current session plan from SQLite.", exception);
        }
    }

    public SessionPlanSnapshotRecord save(SessionPlanSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        try (Connection connection = openReadyConnection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                long sessionId = snapshot.plan().sessionId();
                store.savePlan(connection, snapshot.plan());
                store.replaceParticipants(connection, sessionId, snapshot.participants());
                store.replaceEncounters(connection, sessionId, snapshot.encounters());
                store.replaceRests(connection, sessionId, snapshot.rests());
                store.replaceLootPlaceholders(connection, sessionId, snapshot.lootPlaceholders());
                connection.commit();
                return store.loadSession(connection, sessionId)
                        .orElseThrow(() -> new SQLException("Saved session plan vanished after save."));
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to save session plan to SQLite.", exception);
        }
    }

    public long nextSessionId() {
        try (Connection connection = openReadyConnection()) {
            return store.nextSessionId(connection);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to allocate next session id from SQLite.", exception);
        }
    }

    public void setCurrentSessionId(long sessionId) {
        try (Connection connection = openReadyConnection()) {
            store.setCurrentSessionId(connection, sessionId);
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to update current session pointer in SQLite.", exception);
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
}
