package src.domain.encounter.published;

public record EncounterGenerationTuning(
        int balanceLevel,
        double amountValue,
        int diversityLevel
) {

    public static final int AUTO_BALANCE_LEVEL = -1;
    public static final double AUTO_AMOUNT_VALUE = -1.0;
    public static final int AUTO_DIVERSITY_LEVEL = -1;

    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 2;

    public EncounterGenerationTuning {
        if (balanceLevel != AUTO_BALANCE_LEVEL && (balanceLevel < 1 || balanceLevel > 5)) {
            balanceLevel = DEFAULT_BALANCE_LEVEL;
        }
        if (amountValue != AUTO_AMOUNT_VALUE
                && (!Double.isFinite(amountValue) || amountValue < 1.0 || amountValue > 5.0)) {
            amountValue = DEFAULT_AMOUNT_VALUE;
        }
        if (diversityLevel != AUTO_DIVERSITY_LEVEL && (diversityLevel < 1 || diversityLevel > 4)) {
            diversityLevel = DEFAULT_DIVERSITY_LEVEL;
        }
    }

    public static EncounterGenerationTuning defaultTuning() {
        return new EncounterGenerationTuning(DEFAULT_BALANCE_LEVEL, DEFAULT_AMOUNT_VALUE, DEFAULT_DIVERSITY_LEVEL);
    }

    public static EncounterGenerationTuning autoTuning() {
        return new EncounterGenerationTuning(AUTO_BALANCE_LEVEL, AUTO_AMOUNT_VALUE, AUTO_DIVERSITY_LEVEL);
    }
}
