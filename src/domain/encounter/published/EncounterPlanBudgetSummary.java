package src.domain.encounter.published;

public record EncounterPlanBudgetSummary(
        long planId,
        String name,
        String generatedLabel,
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double xpMultiplier,
        String difficultyLabel
) {

    public EncounterPlanBudgetSummary {
        planId = Math.max(0L, planId);
        name = name == null ? "" : name.trim();
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        creatureCount = Math.max(0, creatureCount);
        totalBaseXp = Math.max(0, totalBaseXp);
        adjustedXp = Math.max(0, adjustedXp);
        xpMultiplier = xpMultiplier <= 0.0 ? 1.0 : xpMultiplier;
        difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
    }
}
