package src.domain.sessionplanner.session.value;

import java.math.BigDecimal;
import java.math.RoundingMode;

public record SessionEncounterAllocation(BigDecimal budgetPercentage) {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    public SessionEncounterAllocation {
        budgetPercentage = normalizePercentage(budgetPercentage);
    }

    public static SessionEncounterAllocation zero() {
        return new SessionEncounterAllocation(BigDecimal.ZERO);
    }

    public static SessionEncounterAllocation hundred() {
        return new SessionEncounterAllocation(HUNDRED);
    }

    public static BigDecimal normalizePercentage(BigDecimal budgetPercentage) {
        if (budgetPercentage == null) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }
        BigDecimal normalized = budgetPercentage.max(BigDecimal.ZERO).min(HUNDRED);
        return normalized.setScale(4, RoundingMode.HALF_UP);
    }
}
