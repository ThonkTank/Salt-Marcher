package src.domain.encounter.model.generation;

import java.util.List;

public record EncounterBudgetSummary(
        List<Integer> activePartyLevels,
        int averagePartyLevel,
        int easyThreshold,
        int mediumThreshold,
        int hardThreshold,
        int deadlyThreshold,
        int dailyBudgetXp,
        int consumedDailyXp,
        int remainingDailyXp
) {
    public EncounterBudgetSummary {
        activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
    }
}
