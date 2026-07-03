package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionParticipantRecord;
import src.data.sessionplanner.model.SessionRestPlacementRecord;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;

final class SessionPlanSqliteDetailReads {

    private static final String SORT_ORDER = "sort_order";

    List<SessionParticipantRecord> loadParticipants(Connection connection, long sessionId) throws SQLException {
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

    List<SessionEncounterRecord> loadEncounters(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT encounter_id, encounter_plan_id, budget_percentage, scene_title, scene_notes, location_id, "
                        + "sort_order "
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
                            resultSet.getString("scene_title"),
                            resultSet.getString("scene_notes"),
                            resultSet.getLong("location_id"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return encounters;
            }
        }
    }

    List<SessionRestPlacementRecord> loadRests(Connection connection, long sessionId) throws SQLException {
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

    List<SessionLootPlaceholderRecord> loadLootPlaceholders(Connection connection, long sessionId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT loot_id, encounter_id, label, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, loot_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionLootPlaceholderRecord> lootPlaceholders = new ArrayList<>();
                while (resultSet.next()) {
                    lootPlaceholders.add(new SessionLootPlaceholderRecord(
                            resultSet.getLong("loot_id"),
                            resultSet.getLong(SessionPlannerPersistenceSchema.SESSION_LOOT_ENCOUNTER_ID_COLUMN),
                            resultSet.getString("label"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return lootPlaceholders;
            }
        }
    }
}
