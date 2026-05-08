package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import src.data.sessionplanner.model.CurrentSessionPointerRecord;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionParticipantRecord;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;
import src.data.sessionplanner.model.SessionRestPlacementRecord;

@SuppressWarnings("PMD.TooManyMethods")
final class SessionPlanSqliteStore {

    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String FROM = " FROM ";
    private static final String WHERE_SESSION_ID = " WHERE session_id = ?";
    private static final String ORDER_BY = " ORDER BY ";
    private static final String SORT_ORDER = "sort_order";
    private static final String SORT_ORDER_COLUMN = ", " + SORT_ORDER;
    private static final String LOAD_CURRENT_SESSION_ID_SQL =
            "SELECT session_id FROM " + SessionPlannerPersistenceSchema.CURRENT_SESSION.name()
                    + " WHERE singleton_id = 1";
    private static final String UPSERT_CURRENT_SESSION_ID_SQL =
            INSERT_INTO + SessionPlannerPersistenceSchema.CURRENT_SESSION.name()
                    + " (singleton_id, session_id) VALUES (1, ?) "
                    + "ON CONFLICT(singleton_id) DO UPDATE SET session_id = excluded.session_id";
    private static final String NEXT_SESSION_ID_SQL =
            "SELECT COALESCE(MAX(session_id), 0) + 1 AS next_session_id FROM "
                    + SessionPlannerPersistenceSchema.SESSION_PLANS.name();
    private static final String LOAD_PLAN_SQL =
            "SELECT session_id, encounter_days, selected_encounter_id, status_text, next_encounter_id, next_loot_id "
                    + "FROM " + SessionPlannerPersistenceSchema.SESSION_PLANS.name()
                    + " WHERE session_id = ?";
    private static final String EXISTS_PLAN_SQL =
            "SELECT 1 FROM " + SessionPlannerPersistenceSchema.SESSION_PLANS.name() + " WHERE session_id = ?";
    private static final String INSERT_PLAN_SQL =
            INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_PLANS.name()
                    + " (session_id, encounter_days, selected_encounter_id, status_text, next_encounter_id, next_loot_id) "
                    + "VALUES (?, ?, ?, ?, ?, ?)";
    private static final String UPDATE_PLAN_SQL =
            "UPDATE " + SessionPlannerPersistenceSchema.SESSION_PLANS.name()
                    + " SET encounter_days = ?, selected_encounter_id = ?, status_text = ?, next_encounter_id = ?, "
                    + "next_loot_id = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?";
    private static final String LOAD_PARTICIPANTS_SQL =
            "SELECT character_id" + SORT_ORDER_COLUMN + FROM + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS.name()
                    + WHERE_SESSION_ID + ORDER_BY + SORT_ORDER + ", character_id";
    private static final String DELETE_PARTICIPANTS_SQL =
            DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS.name() + WHERE_SESSION_ID;
    private static final String INSERT_PARTICIPANT_SQL =
            INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS.name()
                    + " (session_id, character_id, " + SORT_ORDER + ") VALUES (?, ?, ?)";
    private static final String LOAD_ENCOUNTERS_SQL =
            "SELECT encounter_id, encounter_plan_id, budget_percentage" + SORT_ORDER_COLUMN + FROM
                    + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS.name()
                    + WHERE_SESSION_ID + ORDER_BY + SORT_ORDER + ", encounter_id";
    private static final String DELETE_ENCOUNTERS_SQL =
            DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS.name() + WHERE_SESSION_ID;
    private static final String INSERT_ENCOUNTER_SQL =
            INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS.name()
                    + " (session_id, encounter_id, encounter_plan_id, budget_percentage, " + SORT_ORDER
                    + ") VALUES (?, ?, ?, ?, ?)";
    private static final String LOAD_RESTS_SQL =
            "SELECT left_encounter_id, right_encounter_id, rest_kind" + SORT_ORDER_COLUMN + FROM
                    + SessionPlannerPersistenceSchema.SESSION_RESTS.name()
                    + WHERE_SESSION_ID + ORDER_BY + SORT_ORDER + ", left_encounter_id, right_encounter_id";
    private static final String DELETE_RESTS_SQL =
            DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_RESTS.name() + WHERE_SESSION_ID;
    private static final String INSERT_REST_SQL =
            INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_RESTS.name()
                    + " (session_id, left_encounter_id, right_encounter_id, rest_kind, " + SORT_ORDER
                    + ") VALUES (?, ?, ?, ?, ?)";
    private static final String LOAD_LOOT_SQL =
            "SELECT loot_id, label" + SORT_ORDER_COLUMN + FROM
                    + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS.name()
                    + WHERE_SESSION_ID + ORDER_BY + SORT_ORDER + ", loot_id";
    private static final String DELETE_LOOT_SQL =
            DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS.name() + WHERE_SESSION_ID;
    private static final String INSERT_LOOT_SQL =
            INSERT_INTO + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS.name()
                    + " (session_id, loot_id, label, " + SORT_ORDER + ") VALUES (?, ?, ?, ?)";

    Optional<CurrentSessionPointerRecord> loadCurrentPointer(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_CURRENT_SESSION_ID_SQL);
                ResultSet resultSet = statement.executeQuery()) {
            if (!resultSet.next()) {
                return Optional.empty();
            }
            long sessionId = resultSet.getLong("session_id");
            return resultSet.wasNull() ? Optional.empty() : Optional.of(new CurrentSessionPointerRecord(sessionId));
        }
    }

    void setCurrentSessionId(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(UPSERT_CURRENT_SESSION_ID_SQL)) {
            statement.setLong(1, sessionId);
            statement.executeUpdate();
        }
    }

    long nextSessionId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(NEXT_SESSION_ID_SQL);
                ResultSet resultSet = statement.executeQuery()) {
            return resultSet.next() ? Math.max(1L, resultSet.getLong("next_session_id")) : 1L;
        }
    }

    Optional<SessionPlanSnapshotRecord> loadCurrent(Connection connection) throws SQLException {
        Optional<CurrentSessionPointerRecord> current = loadCurrentPointer(connection);
        return current.isEmpty() ? Optional.empty() : loadSession(connection, current.get().sessionId());
    }

    Optional<SessionPlanSnapshotRecord> loadSession(Connection connection, long sessionId) throws SQLException {
        Optional<SessionPlanRecord> plan = loadPlan(connection, sessionId);
        if (plan.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new SessionPlanSnapshotRecord(
                plan.get(),
                loadParticipants(connection, sessionId),
                loadEncounters(connection, sessionId),
                loadRests(connection, sessionId),
                loadLootPlaceholders(connection, sessionId)));
    }

    void savePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        if (existsPlan(connection, plan.sessionId())) {
            updatePlan(connection, plan);
        } else {
            insertPlan(connection, plan);
        }
    }

    void replaceParticipants(Connection connection, long sessionId, List<SessionParticipantRecord> participants) throws SQLException {
        replaceList(connection, DELETE_PARTICIPANTS_SQL, sessionId, INSERT_PARTICIPANT_SQL, participants, (statement, record) -> {
            statement.setLong(1, sessionId);
            statement.setLong(2, record.characterId());
            statement.setInt(3, record.sortOrder());
        });
    }

    void replaceEncounters(Connection connection, long sessionId, List<SessionEncounterRecord> encounters) throws SQLException {
        replaceList(connection, DELETE_ENCOUNTERS_SQL, sessionId, INSERT_ENCOUNTER_SQL, encounters, (statement, record) -> {
            statement.setLong(1, sessionId);
            statement.setLong(2, record.encounterId());
            statement.setLong(3, record.encounterPlanId());
            statement.setString(4, record.budgetPercentage());
            statement.setInt(5, record.sortOrder());
        });
    }

    void replaceRests(Connection connection, long sessionId, List<SessionRestPlacementRecord> rests) throws SQLException {
        replaceList(connection, DELETE_RESTS_SQL, sessionId, INSERT_REST_SQL, rests, (statement, record) -> {
            statement.setLong(1, sessionId);
            statement.setLong(2, record.leftEncounterId());
            statement.setLong(3, record.rightEncounterId());
            statement.setString(4, record.restKind());
            statement.setInt(5, record.sortOrder());
        });
    }

    void replaceLootPlaceholders(
            Connection connection,
            long sessionId,
            List<SessionLootPlaceholderRecord> lootPlaceholders
    ) throws SQLException {
        replaceList(connection, DELETE_LOOT_SQL, sessionId, INSERT_LOOT_SQL, lootPlaceholders, (statement, record) -> {
            statement.setLong(1, sessionId);
            statement.setLong(2, record.lootId());
            statement.setString(3, record.label());
            statement.setInt(4, record.sortOrder());
        });
    }

    private Optional<SessionPlanRecord> loadPlan(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_PLAN_SQL)) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.of(new SessionPlanRecord(
                        resultSet.getLong("session_id"),
                        resultSet.getString("encounter_days"),
                        resultSet.getLong("selected_encounter_id"),
                        resultSet.getString("status_text"),
                        resultSet.getLong("next_encounter_id"),
                        resultSet.getLong("next_loot_id")));
            }
        }
    }

    private List<SessionParticipantRecord> loadParticipants(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_PARTICIPANTS_SQL)) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionParticipantRecord> participants = new ArrayList<>();
                while (resultSet.next()) {
                    participants.add(new SessionParticipantRecord(
                            resultSet.getLong("character_id"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return participants;
            }
        }
    }

    private List<SessionEncounterRecord> loadEncounters(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_ENCOUNTERS_SQL)) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionEncounterRecord> encounters = new ArrayList<>();
                while (resultSet.next()) {
                    encounters.add(new SessionEncounterRecord(
                            resultSet.getLong("encounter_id"),
                            resultSet.getLong("encounter_plan_id"),
                            resultSet.getString("budget_percentage"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return encounters;
            }
        }
    }

    private List<SessionRestPlacementRecord> loadRests(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_RESTS_SQL)) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionRestPlacementRecord> rests = new ArrayList<>();
                while (resultSet.next()) {
                    rests.add(new SessionRestPlacementRecord(
                            resultSet.getLong("left_encounter_id"),
                            resultSet.getLong("right_encounter_id"),
                            resultSet.getString("rest_kind"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return rests;
            }
        }
    }

    private List<SessionLootPlaceholderRecord> loadLootPlaceholders(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(LOAD_LOOT_SQL)) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionLootPlaceholderRecord> lootPlaceholders = new ArrayList<>();
                while (resultSet.next()) {
                    lootPlaceholders.add(new SessionLootPlaceholderRecord(
                            resultSet.getLong("loot_id"),
                            resultSet.getString("label"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return lootPlaceholders;
            }
        }
    }

    private boolean existsPlan(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(EXISTS_PLAN_SQL)) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    private void insertPlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(INSERT_PLAN_SQL)) {
            statement.setLong(1, plan.sessionId());
            statement.setString(2, plan.encounterDays());
            statement.setLong(3, plan.selectedEncounterId());
            statement.setString(4, plan.statusText());
            statement.setLong(5, plan.nextEncounterId());
            statement.setLong(6, plan.nextLootId());
            statement.executeUpdate();
        }
    }

    private void updatePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(UPDATE_PLAN_SQL)) {
            statement.setString(1, plan.encounterDays());
            statement.setLong(2, plan.selectedEncounterId());
            statement.setString(3, plan.statusText());
            statement.setLong(4, plan.nextEncounterId());
            statement.setLong(5, plan.nextLootId());
            statement.setLong(6, plan.sessionId());
            statement.executeUpdate();
        }
    }

    private <T> void replaceList(
            Connection connection,
            String deleteSql,
            long sessionId,
            String insertSql,
            List<T> values,
            BatchBinder<T> binder
    ) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(deleteSql)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
        if (values == null || values.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(insertSql)) {
            for (T value : values) {
                binder.bind(insert, value);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    @FunctionalInterface
    private interface BatchBinder<T> {

        void bind(PreparedStatement statement, T value) throws SQLException;
    }
}
