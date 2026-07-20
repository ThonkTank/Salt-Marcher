package features.sessionplanner.adapter.sqlite.gateway.local;

import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteMigration;
import platform.persistence.SqliteSchemaValidator;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import platform.persistence.SqliteQueryCounter;

public final class SqliteSessionPlannerLocalGateway {

    private final FeatureStoreHandle connections;
    private final SessionPlanSqliteReads reads;
    private final SessionPlanSqliteWrites writes;

    public static FeatureStoreDefinition storeDefinition() {
        SessionPlannerSchemaMigrator schemaMigrator = new SessionPlannerSchemaMigrator();
        SqliteSchemaValidator targetSchema = SqliteSchemaValidator.builder()
                .table(SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE,
                        "session_id", "revision", "display_name", "encounter_days", "selected_encounter_id",
                        "status_text", "next_encounter_id", "next_loot_id", "updated_at")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE, "session_id")
                .table(SessionPlannerPersistenceSchema.CURRENT_SESSION_TABLE, "singleton_id", "session_id")
                .primaryKey(SessionPlannerPersistenceSchema.CURRENT_SESSION_TABLE, "singleton_id")
                .table(SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE,
                        "session_id", "character_id", "sort_order")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE,
                        "session_id", "character_id")
                .table(SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE,
                        "session_id", "encounter_id", "encounter_plan_id", "budget_percentage", "scene_title",
                        "scene_notes", "location_id", "sort_order")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE,
                        "session_id", "encounter_id")
                .table(SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE,
                        "session_id", "left_encounter_id", "right_encounter_id", "rest_kind", "sort_order")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE,
                        "session_id", "left_encounter_id", "right_encounter_id")
                .table(SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE,
                        "session_id", "loot_id", "encounter_id", "label", "sort_order")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE,
                        "session_id", "loot_id")
                .table(SessionPlannerPersistenceSchema.SESSION_GENERATED_REWARDS_TABLE,
                        "session_id", "scene_id", "generation_id", "treasure_id", "last_known_label", "sort_order")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_GENERATED_REWARDS_TABLE,
                        "session_id", "generation_id", "treasure_id")
                .table(SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE,
                        "session_id", "note_id", "scene_id", "note_text", "sort_order")
                .primaryKey(SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE,
                        "session_id", "note_id")
                .index("idx_session_planner_participants_order",
                        SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE,
                        false, "session_id", "sort_order")
                .index("idx_session_planner_encounters_order",
                        SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE,
                        false, "session_id", "sort_order")
                .index("idx_session_planner_rests_order",
                        SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE,
                        false, "session_id", "sort_order")
                .index("idx_session_planner_loot_order",
                        SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE,
                        false, "session_id", "sort_order")
                .index("idx_session_planner_generated_rewards_order",
                        SessionPlannerPersistenceSchema.SESSION_GENERATED_REWARDS_TABLE,
                        false, "session_id", "sort_order")
                .index("idx_session_planner_manual_loot_notes_order",
                        SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE,
                        false, "session_id", "sort_order")
                .build();
        return FeatureStoreDefinition.validated(
                "session-planner", targetSchema,
                new SqliteMigration(1, schemaMigrator::ensureSchema),
                new SqliteMigration(2, schemaMigrator::addGeneratedRewards),
                new SqliteMigration(3, schemaMigrator::addRevisionAndManualLootNotes),
                new SqliteMigration(4, schemaMigrator::repairTargetSchema));
    }

    public SqliteSessionPlannerLocalGateway(FeatureStoreHandle store) {
        this(store, new SessionPlanSqliteReads(), new SessionPlanSqliteWrites());
    }

    SqliteSessionPlannerLocalGateway(
            FeatureStoreHandle store,
            SessionPlanSqliteReads reads,
            SessionPlanSqliteWrites writes) {
        this.connections = FeatureStoreHandle.requireOwner(store, "session-planner");
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

    public WorkspaceRead loadWorkspace() {
        SqliteQueryCounter counted;
        try {
            counted = new SqliteQueryCounter(openReadyConnection());
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load session planner workspace from SQLite.", exception);
        }
        try (Connection connection = counted.connection()) {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                WorkspaceRead result = reads.loadWorkspace(connection);
                connection.commit();
                return new WorkspaceRead(result.currentSessionId(), result.sessions(), counted.queryCount());
            } catch (SQLException | RuntimeException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load session planner workspace from SQLite.", exception);
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

    public record WorkspaceRead(long currentSessionId, List<SessionPlanSnapshotRecord> sessions, int queryCount) {
        public WorkspaceRead {
            currentSessionId = Math.max(0L, currentSessionId);
            sessions = sessions == null ? List.of() : List.copyOf(sessions);
            if (queryCount < 0) {
                throw new IllegalArgumentException("query count must not be negative");
            }
        }
    }
}
