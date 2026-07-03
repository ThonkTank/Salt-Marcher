package src.data.sessionplanner.model;

public record SessionEncounterRecord(
        long encounterId,
        long encounterPlanId,
        String budgetPercentage,
        String sceneTitle,
        String sceneNotes,
        long locationId,
        int sortOrder
) {

    public SessionEncounterRecord {
        encounterId = Math.max(0L, encounterId);
        encounterPlanId = Math.max(0L, encounterPlanId);
        budgetPercentage = budgetPercentage == null ? "0.0000" : budgetPercentage.trim();
        sceneTitle = sceneTitle == null ? "" : sceneTitle.trim();
        sceneNotes = sceneNotes == null ? "" : sceneNotes.trim();
        locationId = Math.max(0L, locationId);
        sortOrder = Math.max(0, sortOrder);
    }
}
