package features.sessionplanner.adapter.sqlite.gateway.local;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import features.sessionplanner.adapter.sqlite.model.CurrentSessionPointerRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlanSnapshotRecord;
import features.sessionplanner.adapter.sqlite.model.SessionPlannerPersistenceSchema;

final class SessionPlanSqliteReads {

    private final SessionPlanSqliteDetailReads detailReads = new SessionPlanSqliteDetailReads();

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
                detailReads.loadParticipants(connection, sessionId),
                detailReads.loadEncounters(connection, sessionId),
                detailReads.loadRests(connection, sessionId),
                detailReads.loadManualLootNotes(connection, sessionId),
                detailReads.loadGeneratedRewards(connection, sessionId)));
    }

    List<SessionPlanRecord> listSessions(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT session_id, revision, display_name, encounter_days, selected_encounter_id, status_text, "
                        + "next_encounter_id, next_loot_id FROM "
                        + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE
                        + " ORDER BY LOWER(display_name), session_id");
                ResultSet resultSet = statement.executeQuery()) {
            List<SessionPlanRecord> sessions = new ArrayList<>();
            while (resultSet.next()) {
                sessions.add(planRecord(resultSet));
            }
            return List.copyOf(sessions);
        }
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
                "SELECT session_id, revision, display_name, encounter_days, selected_encounter_id, status_text, "
                        + "next_encounter_id, next_loot_id "
                        + "FROM " + SessionPlannerPersistenceSchema.SESSION_PLANS_TABLE + " WHERE session_id = ?")) {
            statement.setLong(1, sessionId);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.of(planRecord(resultSet));
            }
        }
    }

    private static SessionPlanRecord planRecord(ResultSet resultSet) throws SQLException {
        return new SessionPlanRecord(
                resultSet.getLong("session_id"),
                resultSet.getLong("revision"),
                resultSet.getString("display_name"),
                resultSet.getString("encounter_days"),
                resultSet.getLong("selected_encounter_id"),
                resultSet.getString("status_text"),
                resultSet.getLong("next_encounter_id"),
                resultSet.getLong("next_loot_id"));
    }

}
