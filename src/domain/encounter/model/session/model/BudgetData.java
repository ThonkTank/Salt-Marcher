package src.domain.encounter.model.session.model;

import java.util.List;

public record BudgetData(
        List<Integer> partyLevels,
        int averageLevel,
        int easyXp,
        int mediumXp,
        int hardXp,
        int deadlyXp
) {
    public BudgetData {
        partyLevels = partyLevels == null ? List.of() : List.copyOf(partyLevels);
    }
}
