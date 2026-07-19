package features.sessionplanner.adapter.sqlite.model;

public record SessionPlanRecord(
        long sessionId,
        long revision,
        String displayName,
        String encounterDays,
        long selectedEncounterId,
        String statusText,
        long nextEncounterId,
        long nextLootId
) {

    public SessionPlanRecord {
        sessionId = Math.max(1L, sessionId);
        if (revision < 1L) {
            throw new IllegalArgumentException("session revision must be positive");
        }
        displayName = displayName == null || displayName.isBlank()
                ? "Session #" + sessionId
                : displayName.trim();
        encounterDays = encounterDays == null ? "1" : encounterDays.trim();
        selectedEncounterId = Math.max(0L, selectedEncounterId);
        statusText = statusText == null ? "" : statusText.trim();
        nextEncounterId = Math.max(1L, nextEncounterId);
        nextLootId = Math.max(1L, nextLootId);
    }
}
