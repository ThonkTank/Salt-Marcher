package features.sessionplanner.api;

import java.util.List;

/** Stable source facts; importing creates an independent Scene-owned copy. */
public record PreparedSceneSource(
        long sessionId,
        String sessionName,
        long sceneId,
        String title,
        String notes,
        long locationId,
        long encounterPlanId,
        List<Long> participantIds
) {

    public PreparedSceneSource {
        sessionId = Math.max(1L, sessionId);
        sessionName = normalized(sessionName, "Session #" + sessionId);
        sceneId = Math.max(1L, sceneId);
        title = normalized(title, "Szene " + sceneId);
        notes = notes == null ? "" : notes.trim();
        locationId = Math.max(0L, locationId);
        encounterPlanId = Math.max(0L, encounterPlanId);
        participantIds = participantIds == null ? List.of() : participantIds.stream()
                .filter(id -> id != null && id.longValue() > 0L)
                .distinct()
                .toList();
    }

    private static String normalized(String value, String fallback) {
        String candidate = value == null ? "" : value.trim();
        return candidate.isBlank() ? fallback : candidate;
    }
}
