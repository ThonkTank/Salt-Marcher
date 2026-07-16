package features.sessionplanner.domain.session;

import java.math.BigDecimal;
import java.math.RoundingMode;

public record EncounterDays(BigDecimal value) {

    public EncounterDays {
        value = normalize(value);
    }

    public static EncounterDays one() {
        return new EncounterDays(BigDecimal.ONE);
    }

    public int scaleBudget(int budgetXp) {
        return BigDecimal.valueOf(Math.max(0, budgetXp))
                .multiply(value)
                .setScale(0, RoundingMode.HALF_UP)
                .intValue();
    }

    public String displayText() {
        return value.stripTrailingZeros().toPlainString();
    }

    private static BigDecimal normalize(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ONE;
        }
        BigDecimal normalized = value.max(BigDecimal.ZERO).stripTrailingZeros();
        return normalized.scale() < 0 ? normalized.setScale(0) : normalized;
    }
}
