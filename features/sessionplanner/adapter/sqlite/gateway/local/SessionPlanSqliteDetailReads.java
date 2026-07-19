package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionGeneratedRewardRecord;
import features.sessionplanner.adapter.sqlite.model.SessionManualLootNoteRecord;
import features.sessionplanner.adapter.sqlite.model.SessionParticipantRecord;
import features.sessionplanner.adapter.sqlite.model.SessionRestPlacementRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

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

    List<SessionManualLootNoteRecord> loadManualLootNotes(Connection connection, long sessionId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT note_id, scene_id, note_text, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_MANUAL_LOOT_NOTES_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, note_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionManualLootNoteRecord> notes = new ArrayList<>();
                while (resultSet.next()) {
                    notes.add(new SessionManualLootNoteRecord(
                            resultSet.getLong("note_id"),
                            resultSet.getLong("scene_id"),
                            resultSet.getString("note_text"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return notes;
            }
        }
    }

    List<SessionGeneratedRewardRecord> loadGeneratedRewards(Connection connection, long sessionId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT scene_id, generation_id, treasure_id, last_known_label, sort_order FROM "
                        + SessionPlannerPersistenceSchema.SESSION_GENERATED_REWARDS_TABLE
                        + " WHERE session_id = ? ORDER BY sort_order, generation_id, treasure_id")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                List<SessionGeneratedRewardRecord> rewards = new ArrayList<>();
                while (resultSet.next()) {
                    rewards.add(new SessionGeneratedRewardRecord(
                            resultSet.getLong("scene_id"),
                            resultSet.getString("generation_id"),
                            resultSet.getLong("treasure_id"),
                            resultSet.getString("last_known_label"),
                            resultSet.getInt(SORT_ORDER)));
                }
                return List.copyOf(rewards);
            }
        }
    }
}
