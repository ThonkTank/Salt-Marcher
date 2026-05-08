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
        balanceLevel = normalizeDiscrete(balanceLevel, AUTO_BALANCE_LEVEL, DEFAULT_BALANCE_LEVEL, 1, 5);
        amountValue = normalizeAmountValue(amountValue);
        diversityLevel = normalizeDiscrete(diversityLevel, AUTO_DIVERSITY_LEVEL, DEFAULT_DIVERSITY_LEVEL, 1, 4);
    }

    public static EncounterGenerationTuning defaultTuning() {
        return new EncounterGenerationTuning(DEFAULT_BALANCE_LEVEL, DEFAULT_AMOUNT_VALUE, DEFAULT_DIVERSITY_LEVEL);
    }

    public static EncounterGenerationTuning autoTuning() {
        return new EncounterGenerationTuning(AUTO_BALANCE_LEVEL, AUTO_AMOUNT_VALUE, AUTO_DIVERSITY_LEVEL);
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

    private static int normalizeDiscrete(int value, int autoValue, int defaultValue, int minimumValue, int maximumValue) {
        if (value == autoValue) {
            return autoValue;
        }
        return value < minimumValue || value > maximumValue ? defaultValue : value;
    }

    private static double normalizeAmountValue(double value) {
        if (value == AUTO_AMOUNT_VALUE) {
            return AUTO_AMOUNT_VALUE;
        }
        return Double.isFinite(value) && value >= 1.0 && value <= 5.0 ? value : DEFAULT_AMOUNT_VALUE;
    }
}
