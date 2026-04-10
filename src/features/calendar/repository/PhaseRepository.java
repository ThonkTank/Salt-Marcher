package features.calendar.repository;

import features.calendar.state.PhaseAdvanceState;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

@SuppressWarnings("unused")
public final class PhaseRepository {

    private PhaseRepository() {
        throw new AssertionError("No instances");
    }

    public static Optional<PhaseAdvanceState> loadPhaseAdvance(Connection conn, Long currentPhaseId) throws SQLException {
        Long firstPhaseId = loadFirstPhaseId(conn);
        if (firstPhaseId == null) {
            return Optional.empty();
        }
        if (currentPhaseId == null) {
            return Optional.of(new PhaseAdvanceState(firstPhaseId, true));
        }
        Long nextPhaseId = loadNextPhaseId(conn, currentPhaseId);
        if (nextPhaseId == null) {
            return Optional.of(new PhaseAdvanceState(firstPhaseId, true));
        }
        return Optional.of(new PhaseAdvanceState(nextPhaseId, nextPhaseId.equals(firstPhaseId)));
    }

    private static Long loadFirstPhaseId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT phase_id FROM time_of_day_phases ORDER BY display_order LIMIT 1");
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                return rs.getLong("phase_id");
            }
        }
        return null;
    }

    private static Long loadNextPhaseId(Connection conn, long currentPhaseId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT phase_id FROM time_of_day_phases"
                        + " WHERE display_order > (SELECT display_order FROM time_of_day_phases WHERE phase_id = ?)"
                        + " ORDER BY display_order LIMIT 1")) {
            ps.setLong(1, currentPhaseId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getLong("phase_id");
                }
            }
        }
        return null;
    }
}
