package src.data.sessionplanner.model;

public record SessionPlanRecord(
        long sessionId,
        String encounterDays,
        long selectedEncounterId,
        String statusText,
        long nextEncounterId,
        long nextLootId
) {

    public SessionPlanRecord {
        sessionId = Math.max(1L, sessionId);
        encounterDays = encounterDays == null ? "1" : encounterDays.trim();
        selectedEncounterId = Math.max(0L, selectedEncounterId);
        statusText = statusText == null ? "" : statusText.trim();
        nextEncounterId = Math.max(1L, nextEncounterId);
        nextLootId = Math.max(1L, nextLootId);
    }
}
