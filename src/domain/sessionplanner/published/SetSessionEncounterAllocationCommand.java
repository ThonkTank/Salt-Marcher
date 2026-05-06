package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public record SetSessionEncounterAllocationCommand(
        long encounterId,
        BigDecimal budgetPercentage
) {

    public SetSessionEncounterAllocationCommand {
        encounterId = Math.max(0L, encounterId);
        budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
    }
}
