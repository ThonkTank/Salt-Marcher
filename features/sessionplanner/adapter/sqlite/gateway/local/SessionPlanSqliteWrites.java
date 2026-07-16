package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionLootPlaceholderRecord;
import features.sessionplanner.adapter.sqlite.model.SessionParticipantRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionRestPlacementRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

final class SessionPlanSqliteWrites {

    private static final String INSERT_INTO = "INSERT INTO ";

    private final SessionPlanChildTableSqliteWrites childTableWrites = new SessionPlanChildTableSqliteWrites();

    void setCurrentSessionId(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.CURRENT_SESSION_TABLE
                        + " (singleton_id, session_id) VALUES (1, ?) "
                        + "ON CONFLICT(singleton_id) DO UPDATE SET session_id = excluded.session_id")) {
            statement.setLong(1, sessionId);
            statement.executeUpdate();
        }
    }

    void renameSession(Connection connection, long sessionId, String displayName) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?")) {
            statement.setString(1, displayName == null ? "" : displayName.trim());
            statement.setLong(2, sessionId);
            statement.executeUpdate();
        }
    }

    void deleteSession(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " WHERE session_id = ?")) {
            statement.setLong(1, sessionId);
            statement.executeUpdate();
        }
    }

    void savePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        if (existsPlan(connection, plan.sessionId())) {
            updatePlan(connection, plan);
        } else {
            insertPlan(connection, plan);
        }
    }

    void replaceParticipants(Connection connection, long sessionId, List<SessionParticipantRecord> participants)
            throws SQLException {
        childTableWrites.replaceParticipants(connection, sessionId, participants);
    }

    void replaceEncounters(Connection connection, long sessionId, List<SessionEncounterRecord> encounters)
            throws SQLException {
        childTableWrites.replaceEncounters(connection, sessionId, encounters);
    }

    void replaceRests(Connection connection, long sessionId, List<SessionRestPlacementRecord> rests)
            throws SQLException {
        childTableWrites.replaceRests(connection, sessionId, rests);
    }

    void replaceLootPlaceholders(
            Connection connection,
            long sessionId,
            List<SessionLootPlaceholderRecord> lootPlaceholders
    ) throws SQLException {
        childTableWrites.replaceLootPlaceholders(connection, sessionId, lootPlaceholders);
    }

    private static boolean existsPlan(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " WHERE session_id = ?")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    private static void insertPlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " "
                        + "(session_id, display_name, encounter_days, selected_encounter_id, status_text, "
                        + "next_encounter_id, next_loot_id) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            statement.setLong(1, plan.sessionId());
            statement.setString(2, plan.displayName());
            statement.setString(3, plan.encounterDays());
            statement.setLong(4, plan.selectedEncounterId());
            statement.setString(5, plan.statusText());
            statement.setLong(6, plan.nextEncounterId());
            statement.setLong(7, plan.nextLootId());
            statement.executeUpdate();
        }
    }

    private static void updatePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " "
                        + "SET display_name = ?, encounter_days = ?, selected_encounter_id = ?, status_text = ?, "
                        + "next_encounter_id = ?, next_loot_id = ?, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE session_id = ?")) {
            statement.setString(1, plan.displayName());
            statement.setString(2, plan.encounterDays());
            statement.setLong(3, plan.selectedEncounterId());
            statement.setString(4, plan.statusText());
            statement.setLong(5, plan.nextEncounterId());
            statement.setLong(6, plan.nextLootId());
            statement.setLong(7, plan.sessionId());
            statement.executeUpdate();
        }
    }
}
