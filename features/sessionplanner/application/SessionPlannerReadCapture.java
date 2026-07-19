package features.sessionplanner.application;

import features.sessionplanner.domain.session.SessionPlan;
import java.util.List;
import java.util.Optional;

/** Complete Session Planner-owned read captured at one storage instant. */
public record SessionPlannerReadCapture(long currentSessionId, List<SessionPlan> sessions) {

    public SessionPlannerReadCapture {
        currentSessionId = Math.max(0L, currentSessionId);
        sessions = sessions == null ? List.of() : List.copyOf(sessions);
        if (sessions.stream().map(SessionPlan::sessionId).distinct().count() != sessions.size()) {
            throw new IllegalArgumentException("session ids must be unique");
        }
        long selectedId = currentSessionId;
        if (selectedId > 0L && sessions.stream().noneMatch(session -> session.sessionId() == selectedId)) {
            throw new IllegalArgumentException("current session must be part of the capture");
        }
    }

    public Optional<SessionPlan> currentSession() {
        return sessions.stream().filter(session -> session.sessionId() == currentSessionId).findFirst();
    }
}
