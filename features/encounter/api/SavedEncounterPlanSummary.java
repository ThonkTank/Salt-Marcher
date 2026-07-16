package features.encounter.api;

public record SavedEncounterPlanSummary(
        long planId,
        String name,
        String summaryText
) {

    public SavedEncounterPlanSummary {
        planId = Math.max(0L, planId);
        name = name == null ? "" : name.trim();
        summaryText = summaryText == null ? "" : summaryText.trim();
    }
}
