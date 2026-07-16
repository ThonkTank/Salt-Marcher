package features.sessionplanner.domain.session;

public record SessionPlanSummary(
        long sessionId,
        String displayName
) {

    public SessionPlanSummary {
        sessionId = Math.max(1L, sessionId);
        displayName = displayName == null || displayName.isBlank()
                ? "Session #" + sessionId
                : displayName.trim();
    }
}
