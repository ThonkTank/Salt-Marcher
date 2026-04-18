package src.domain.party.api;

import java.util.List;

public record AdventuringDaySummary(
        List<Integer> activePartyLevels,
        int remainingToShortRest,
        int remainingToLongRest,
        int consumedXp,
        int totalBudgetXp,
        int consumedPercent,
        List<RestCadenceStatus> restCadenceStatuses
) {
    public AdventuringDaySummary {
        activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
        restCadenceStatuses = restCadenceStatuses == null ? List.of() : List.copyOf(restCadenceStatuses);
    }
}
