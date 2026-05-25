package src.data.sessionplanner.gateway.local;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import src.data.sessionplanner.model.SessionEncounterRecord;
import src.data.sessionplanner.model.SessionLootPlaceholderRecord;
import src.data.sessionplanner.model.SessionParticipantRecord;
import src.data.sessionplanner.model.SessionPlanRecord;
import src.data.sessionplanner.model.SessionPlanSnapshotRecord;
import src.data.sessionplanner.model.SessionRestPlacementRecord;

final class SessionPlanSqliteStore {

    private final SessionPlanSqliteReads reads = new SessionPlanSqliteReads();
    private final SessionPlanSqliteWrites writes = new SessionPlanSqliteWrites();

    void setCurrentSessionId(Connection connection, long sessionId) throws SQLException {
        writes.setCurrentSessionId(connection, sessionId);
    }

    long nextSessionId(Connection connection) throws SQLException {
        return reads.nextSessionId(connection);
    }

    Optional<SessionPlanSnapshotRecord> loadCurrent(Connection connection) throws SQLException {
        return reads.loadCurrent(connection);
    }

    Optional<SessionPlanSnapshotRecord> loadSession(Connection connection, long sessionId) throws SQLException {
        return reads.loadSession(connection, sessionId);
    }

    void savePlan(Connection connection, SessionPlanRecord plan) throws SQLException {
        writes.savePlan(connection, plan);
    }

    void replaceParticipants(
            Connection connection,
            long sessionId,
            List<SessionParticipantRecord> participants
    ) throws SQLException {
        writes.replaceParticipants(connection, sessionId, participants);
    }

    void replaceEncounters(Connection connection, long sessionId, List<SessionEncounterRecord> encounters)
            throws SQLException {
        writes.replaceEncounters(connection, sessionId, encounters);
    }

    void replaceRests(Connection connection, long sessionId, List<SessionRestPlacementRecord> rests)
            throws SQLException {
        writes.replaceRests(connection, sessionId, rests);
    }

    void replaceLootPlaceholders(
            Connection connection,
            long sessionId,
            List<SessionLootPlaceholderRecord> lootPlaceholders
    ) throws SQLException {
        writes.replaceLootPlaceholders(connection, sessionId, lootPlaceholders);
    }
}
