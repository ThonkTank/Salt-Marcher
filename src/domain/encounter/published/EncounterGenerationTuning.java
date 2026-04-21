package src.domain.encounter.published;

public record EncounterGenerationTuning(
        int balanceLevel,
        double amountValue,
        int diversityLevel
) {

    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 2;

    public EncounterGenerationTuning {
        balanceLevel = normalizeBalance(balanceLevel);
        amountValue = normalizeAmount(amountValue);
        diversityLevel = normalizeDiversity(diversityLevel);
    }

    public static EncounterGenerationTuning defaultTuning() {
        return new EncounterGenerationTuning(DEFAULT_BALANCE_LEVEL, DEFAULT_AMOUNT_VALUE, DEFAULT_DIVERSITY_LEVEL);
    }

    private static int normalizeBalance(int value) {
        return value < 1 || value > 5 ? DEFAULT_BALANCE_LEVEL : value;
    }

    private static double normalizeAmount(double value) {
        return Double.isFinite(value) && value >= 1.0 && value <= 5.0 ? value : DEFAULT_AMOUNT_VALUE;
    }

    private static int normalizeDiversity(int value) {
        return value < 1 || value > 4 ? DEFAULT_DIVERSITY_LEVEL : value;
    }
}
