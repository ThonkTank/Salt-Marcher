package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public record SessionPlannerEncounterAllocationCommand(
        long encounterId,
        BigDecimal budgetPercentage
) {

    public SessionPlannerEncounterAllocationCommand {
        encounterId = Math.max(0L, encounterId);
        budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
    }
}
