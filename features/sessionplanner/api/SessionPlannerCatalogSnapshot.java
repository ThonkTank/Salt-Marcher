package features.sessionplanner.api;

import java.util.List;

public record SessionPlannerCatalogSnapshot(
        List<SessionSummary> sessions,
        long selectedSessionId,
        String statusText
) {

    public SessionPlannerCatalogSnapshot {
        sessions = sessions == null ? List.of() : List.copyOf(sessions);
        selectedSessionId = Math.max(0L, selectedSessionId);
        statusText = statusText == null ? "" : statusText.trim();
    }

    public static SessionPlannerCatalogSnapshot empty() {
        return new SessionPlannerCatalogSnapshot(List.of(), 0L, "");
    }

    public record SessionSummary(
            long sessionId,
            String displayName
    ) {

        public SessionSummary {
            sessionId = Math.max(1L, sessionId);
            displayName = displayName == null || displayName.isBlank()
                    ? "Session #" + sessionId
                    : displayName.trim();
        }
    }
}
