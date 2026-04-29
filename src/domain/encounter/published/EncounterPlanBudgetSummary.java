package src.domain.encounter.published;

import java.util.List;

public record EncounterPlanBudgetSummary(
        long planId,
        String name,
        String generatedLabel,
        List<Integer> partyLevels,
        int averageLevel,
        int easyXp,
        int mediumXp,
        int hardXp,
        int deadlyXp,
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double xpMultiplier,
        String difficultyLabel
) {

    public EncounterPlanBudgetSummary {
        name = name == null ? "" : name.trim();
        generatedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        partyLevels = partyLevels == null ? List.of() : List.copyOf(partyLevels);
        creatureCount = Math.max(0, creatureCount);
        totalBaseXp = Math.max(0, totalBaseXp);
        adjustedXp = Math.max(0, adjustedXp);
        xpMultiplier = xpMultiplier <= 0.0 ? 1.0 : xpMultiplier;
        difficultyLabel = difficultyLabel == null ? "" : difficultyLabel.trim();
    }
}
