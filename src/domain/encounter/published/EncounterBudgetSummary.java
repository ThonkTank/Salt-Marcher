package src.domain.encounter.published;

import java.util.List;

public record EncounterBudgetSummary(
        List<Integer> partyLevels,
        int averageLevel,
        int easyXp,
        int mediumXp,
        int hardXp,
        int deadlyXp,
        int dailyBudgetXp,
        int consumedDailyXp,
        int remainingDailyXp
) {

    public EncounterBudgetSummary {
        partyLevels = partyLevels == null ? List.of() : List.copyOf(partyLevels);
    }
}
