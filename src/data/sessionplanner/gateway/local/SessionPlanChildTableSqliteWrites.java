package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionParticipantRecord;
import src.data.sessionplanner.model.SessionRestPlacementRecord;
import src.data.sessionplanner.model.SessionPlannerPersistenceSchema;

final class SessionPlanChildTableSqliteWrites {

    private static final String DELETE_FROM = "DELETE FROM ";
    private static final String INSERT_INTO = "INSERT INTO ";
    private static final String WHERE_SESSION_ID = " WHERE session_id = ?";

    void replaceParticipants(Connection connection, long sessionId, List<SessionParticipantRecord> participants)
            throws SQLException {
        deleteSessionParticipants(connection, sessionId);
        if (participants == null || participants.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE
                        + " (session_id, character_id, sort_order) VALUES (?, ?, ?)")) {
            for (SessionParticipantRecord record : participants) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.characterId());
                insert.setInt(3, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceEncounters(Connection connection, long sessionId, List<SessionEncounterRecord> encounters)
            throws SQLException {
        deleteSessionEncounters(connection, sessionId);
        if (encounters == null || encounters.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE
                        + " "
                        + "(session_id, encounter_id, encounter_plan_id, budget_percentage, scene_title, scene_notes, "
                        + "location_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            for (SessionEncounterRecord record : encounters) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.encounterId());
                insert.setLong(3, record.encounterPlanId());
                insert.setString(4, record.budgetPercentage());
                insert.setString(5, record.sceneTitle());
                insert.setString(6, record.sceneNotes());
                insert.setLong(7, record.locationId());
                insert.setInt(8, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceRests(Connection connection, long sessionId, List<SessionRestPlacementRecord> rests)
            throws SQLException {
        deleteSessionRests(connection, sessionId);
        if (rests == null || rests.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE
                        + " "
                        + "(session_id, left_encounter_id, right_encounter_id, rest_kind, sort_order) "
                        + "VALUES (?, ?, ?, ?, ?)")) {
            for (SessionRestPlacementRecord record : rests) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.leftEncounterId());
                insert.setLong(3, record.rightEncounterId());
                insert.setString(4, record.restKind());
                insert.setInt(5, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    void replaceLootPlaceholders(
            Connection connection,
            long sessionId,
            List<SessionLootPlaceholderRecord> lootPlaceholders
    ) throws SQLException {
        deleteSessionLootPlaceholders(connection, sessionId);
        if (lootPlaceholders == null || lootPlaceholders.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE
                        + " "
                        + "(session_id, loot_id, encounter_id, label, sort_order) VALUES (?, ?, ?, ?, ?)")) {
            for (SessionLootPlaceholderRecord record : lootPlaceholders) {
                insert.setLong(1, sessionId);
                insert.setLong(2, record.lootId());
                insert.setLong(3, record.encounterId());
                insert.setString(4, record.label());
                insert.setInt(5, record.sortOrder());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void deleteSessionParticipants(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_PARTICIPANTS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteSessionEncounters(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_ENCOUNTERS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteSessionRests(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_RESTS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }

    private static void deleteSessionLootPlaceholders(Connection connection, long sessionId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
                DELETE_FROM + SessionPlannerPersistenceSchema.SESSION_LOOT_PLACEHOLDERS_TABLE + WHERE_SESSION_ID)) {
            delete.setLong(1, sessionId);
            delete.executeUpdate();
        }
    }
}
