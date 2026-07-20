package features.encounter.api;

public record SavedEncounterPlanSearchHit(long planId, String name, String summaryText) {

    public SavedEncounterPlanSearchHit {
        if (planId <= 0L) {
            throw new IllegalArgumentException("planId must be positive");
        }
        name = name == null ? "" : name.trim();
        summaryText = summaryText == null ? "" : summaryText.trim();
    }
}
