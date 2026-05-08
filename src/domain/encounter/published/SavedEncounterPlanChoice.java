package src.domain.encounter.published;

public record SavedEncounterPlanChoice(
        long planId,
        String name,
        String summaryText
) {

    public SavedEncounterPlanChoice {
        planId = Math.max(0L, planId);
        name = name == null ? "" : name.trim();
        summaryText = summaryText == null ? "" : summaryText.trim();
    }
}
