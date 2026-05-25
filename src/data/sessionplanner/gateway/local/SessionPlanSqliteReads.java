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
import src.data.sessionplanner.model.SessionRestPlacementRecord;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;

final class SessionPlanSqliteReads {

    private static final String SORT_ORDER = "sort_order";

    long nextSessionId(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COALESCE(MAX(session_id), 0) + 1 AS next_session_id FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE);
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

    private Optional<CurrentSessionPointerRecord> loadCurrentPointer(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id FROM "
                        + SessionPlannerPersistenceSchema.CURRENT_SESSION_TABLE
                        + " WHERE singleton_id = 1");
                ResultSet resultSet = statement.executeQuery()) {
            if (!resultSet.next()) {
                return Optional.empty();
            }
            long sessionId = resultSet.getLong("session_id");
            return resultSet.wasNull() ? Optional.empty() : Optional.of(new CurrentSessionPointerRecord(sessionId));
        }
    }

    private Optional<SessionPlanRecord> loadPlan(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, encounter_days, selected_encounter_id, status_text, next_encounter_id, next_loot_id "
                        + "FROM " + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE + " WHERE session_id = ?")) {
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
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT character_id, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, character_id")) {
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
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT encounter_id, encounter_plan_id, budget_percentage, sort_order "
                        + "FROM " + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE + " "
                        + "WHERE session_id = ? ORDER BY sort_order, encounter_id")) {
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
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT left_encounter_id, right_encounter_id, rest_kind, sort_order "
                        + "FROM " + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE + " "
                        + "WHERE session_id = ? ORDER BY sort_order, left_encounter_id, right_encounter_id")) {
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

    private List<SessionLootPlaceholderRecord> loadLootPlaceholders(Connection connection, long sessionId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT loot_id, label, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, loot_id")) {
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
}
