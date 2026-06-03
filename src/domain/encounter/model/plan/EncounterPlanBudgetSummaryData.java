package src.domain.encounter.model.plan;

public record EncounterPlanBudgetSummaryData(
        long planId,
        String planName,
        String generatedLabel,
        int creatureCount,
        int baseXp,
        int adjustedXp,
        double multiplier,
        String difficultyLabel
) {

    public EncounterPlanBudgetSummaryData {
        planName = planName == null ? "" : planName;
        generatedLabel = generatedLabel == null ? "" : generatedLabel;
        difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
    }
}
