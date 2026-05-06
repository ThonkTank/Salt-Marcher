package src.data.sessionplanner.model;

public record SessionEncounterRecord(
        long encounterId,
        long encounterPlanId,
        String budgetPercentage,
        int sortOrder
) {

    public SessionEncounterRecord {
        encounterId = Math.max(0L, encounterId);
        encounterPlanId = Math.max(0L, encounterPlanId);
        budgetPercentage = budgetPercentage == null ? "0.0000" : budgetPercentage.trim();
        sortOrder = Math.max(0, sortOrder);
    }
}
