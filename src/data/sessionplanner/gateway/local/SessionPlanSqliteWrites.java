package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionParticipantRecord;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionRestPlacementRecord;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;

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
                        + "(session_id, encounter_days, selected_encounter_id, status_text, "
                        + "next_encounter_id, next_loot_id) VALUES (?, ?, ?, ?, ?, ?)")) {
            statement.setLong(1, plan.sessionId());
            statement.setString(2, plan.encounterDays());
            statement.setLong(3, plan.selectedEncounterId());
            statement.setString(4, plan.statusText());
            statement.setLong(5, plan.nextEncounterId());
            statement.setLong(6, plan.nextLootId());
            statement.executeUpdate();
        }
    }

    private static void updatePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " "
                        + "SET encounter_days = ?, selected_encounter_id = ?, status_text = ?, "
                        + "next_encounter_id = ?, next_loot_id = ?, updated_at = CURRENT_TIMESTAMP "
                        + "WHERE session_id = ?")) {
            statement.setString(1, plan.encounterDays());
            statement.setLong(2, plan.selectedEncounterId());
            statement.setString(3, plan.statusText());
            statement.setLong(4, plan.nextEncounterId());
            statement.setLong(5, plan.nextLootId());
            statement.setLong(6, plan.sessionId());
            statement.executeUpdate();
        }
    }
}
