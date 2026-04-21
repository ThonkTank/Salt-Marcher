package src.domain.encounter.generation.value;

public record EncounterTuningIntent(
        int balanceLevel,
        double amountValue,
        int diversityLevel
) {

    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 2;

    public EncounterTuningIntent {
        balanceLevel = balanceLevel < 1 || balanceLevel > 5 ? DEFAULT_BALANCE_LEVEL : balanceLevel;
        amountValue = Double.isFinite(amountValue) && amountValue >= 1.0 && amountValue <= 5.0
                ? amountValue
                : DEFAULT_AMOUNT_VALUE;
        diversityLevel = diversityLevel < 1 || diversityLevel > 4 ? DEFAULT_DIVERSITY_LEVEL : diversityLevel;
    }

    public static EncounterTuningIntent defaultIntent() {
        return new EncounterTuningIntent(DEFAULT_BALANCE_LEVEL, DEFAULT_AMOUNT_VALUE, DEFAULT_DIVERSITY_LEVEL);
    }
}
