package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public record SessionPlannerEncounterAllocationCommand(
        long encounterId,
        BigDecimal budgetPercentage
) implements SessionPlannerCommand {

    public SessionPlannerEncounterAllocationCommand {
        encounterId = Math.max(0L, encounterId);
        budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
    }
}
