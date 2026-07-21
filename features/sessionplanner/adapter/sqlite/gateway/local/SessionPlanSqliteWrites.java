package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import features.sessionplanner.adapter.sqlite.model.SessionEncounterRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasureItemRecord;
import features.sessionplanner.adapter.sqlite.model.SessionTreasurePackingRecord;
import features.sessionplanner.adapter.sqlite.model.SessionManualLootNoteRecord;
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

    boolean deleteSession(Connection connection, long sessionId, long expectedRevision) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "DELETE FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " WHERE session_id = ? AND revision = ?")) {
            statement.setLong(1, sessionId);
            statement.setLong(2, expectedRevision);
            return statement.executeUpdate() == 1;
        }
    }

    boolean insertPlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        return insertPlanRow(connection, plan) == 1;
    }

    boolean updatePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        return updatePlanRow(connection, plan) == 1;
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

    void replaceManualLootNotes(
            Connection connection,
            long sessionId,
            List<SessionManualLootNoteRecord> manualLootNotes
    ) throws SQLException {
        childTableWrites.replaceManualLootNotes(connection, sessionId, manualLootNotes);
    }

    void replaceTreasures(
            Connection connection,
            long sessionId,
            List<SessionTreasureRecord> treasures,
            List<SessionTreasureItemRecord> items,
            List<SessionTreasurePackingRecord> packing
    ) throws SQLException {
        childTableWrites.replaceTreasures(connection, sessionId, treasures, items, packing);
    }

    private static int insertPlanRow(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_INTO
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " "
                        + "(session_id, revision, display_name, encounter_days, selected_encounter_id, status_text, "
                        + "next_encounter_id, next_loot_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            statement.setLong(1, plan.sessionId());
            statement.setLong(2, plan.revision());
            statement.setString(3, plan.displayName());
            statement.setString(4, plan.encounterDays());
            statement.setLong(5, plan.selectedEncounterId());
            statement.setString(6, plan.statusText());
            statement.setLong(7, plan.nextEncounterId());
            statement.setLong(8, plan.nextLootId());
            return statement.executeUpdate();
        }
    }

    private static int updatePlanRow(Connection connection, SessionPlanRecord plan) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "UPDATE "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " "
                        + "SET revision = revision + 1, display_name = ?, encounter_days = ?, "
                        + "selected_encounter_id = ?, status_text = ?, next_encounter_id = ?, next_loot_id = ?, "
                        + "updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND revision = ?")) {
            statement.setString(1, plan.displayName());
            statement.setString(2, plan.encounterDays());
            statement.setLong(3, plan.selectedEncounterId());
            statement.setString(4, plan.statusText());
            statement.setLong(5, plan.nextEncounterId());
            statement.setLong(6, plan.nextLootId());
            statement.setLong(7, plan.sessionId());
            statement.setLong(8, plan.revision());
            return statement.executeUpdate();
        }
    }
}
