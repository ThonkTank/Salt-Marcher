package src.domain.sessionplanner.published;

import java.math.BigDecimal;

public final class SetSessionEncounterAllocationCommand {

    private final long encounterId;
    private final BigDecimal budgetPercentage;

    public SetSessionEncounterAllocationCommand(long encounterId, BigDecimal budgetPercentage) {
        this.encounterId = Math.max(0L, encounterId);
        this.budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
    }

    public long encounterId() {
        return encounterId;
    }

    public BigDecimal budgetPercentage() {
        return budgetPercentage;
    }
}
