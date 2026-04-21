package src.domain.encounter.generation.value;

public record EncounterTuningIntent(
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

    public EncounterTuningIntent {
        balanceLevel = normalizeBalance(balanceLevel);
        amountValue = normalizeAmount(amountValue);
        diversityLevel = normalizeDiversity(diversityLevel);
    }

    public static EncounterTuningIntent defaultIntent() {
        return new EncounterTuningIntent(DEFAULT_BALANCE_LEVEL, DEFAULT_AMOUNT_VALUE, DEFAULT_DIVERSITY_LEVEL);
    }

    public static EncounterTuningIntent autoIntent() {
        return new EncounterTuningIntent(AUTO_BALANCE_LEVEL, AUTO_AMOUNT_VALUE, AUTO_DIVERSITY_LEVEL);
    }

    public boolean isBalanceAuto() {
        return balanceLevel == AUTO_BALANCE_LEVEL;
    }

    public boolean isAmountAuto() {
        return amountValue == AUTO_AMOUNT_VALUE;
    }

    public boolean isDiversityAuto() {
        return diversityLevel == AUTO_DIVERSITY_LEVEL;
    }

    public boolean hasAuto() {
        return isBalanceAuto() || isAmountAuto() || isDiversityAuto();
    }

    private static int normalizeBalance(int value) {
        if (value == AUTO_BALANCE_LEVEL) {
            return AUTO_BALANCE_LEVEL;
        }
        return value < 1 || value > 5 ? DEFAULT_BALANCE_LEVEL : value;
    }

    private static double normalizeAmount(double value) {
        if (value == AUTO_AMOUNT_VALUE) {
            return AUTO_AMOUNT_VALUE;
        }
        return Double.isFinite(value) && value >= 1.0 && value <= 5.0 ? value : DEFAULT_AMOUNT_VALUE;
    }

    private static int normalizeDiversity(int value) {
        if (value == AUTO_DIVERSITY_LEVEL) {
            return AUTO_DIVERSITY_LEVEL;
        }
        return value < 1 || value > 4 ? DEFAULT_DIVERSITY_LEVEL : value;
    }
}
