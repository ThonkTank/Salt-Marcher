package features.sessionplanner.domain.session;

public record SessionEncounter(
        long encounterId,
        long encounterPlanId,
        SessionEncounterAllocation allocation,
        String sceneTitle,
        String sceneNotes,
        long locationId
) {

    public SessionEncounter {
        encounterId = Math.max(1L, encounterId);
        encounterPlanId = Math.max(0L, encounterPlanId);
        allocation = allocation == null ? SessionEncounterAllocation.zero() : allocation;
        sceneTitle = normalizedSceneTitle(sceneTitle, encounterId);
        sceneNotes = sceneNotes == null ? "" : sceneNotes.trim();
        locationId = Math.max(0L, locationId);
    }

    public SessionEncounter(long encounterId, long encounterPlanId, SessionEncounterAllocation allocation) {
        this(encounterId, encounterPlanId, allocation, "", "", 0L);
    }

    public SessionEncounter withAllocation(SessionEncounterAllocation allocation) {
        return new SessionEncounter(encounterId, encounterPlanId, allocation, sceneTitle, sceneNotes, locationId);
    }

    public SessionEncounter withScene(String title, String notes, long locationId) {
        return new SessionEncounter(encounterId, encounterPlanId, allocation, title, notes, locationId);
    }

    private static String normalizedSceneTitle(String title, long encounterId) {
        String normalized = title == null ? "" : title.trim();
        return normalized.isBlank() ? "Szene " + Math.max(1L, encounterId) : normalized;
    }
}
