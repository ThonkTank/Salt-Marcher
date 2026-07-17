package features.encounter.api;

/** Encounter-state-owned generation difficulty and composition tuning. */
public record EncounterTuningSettings(
        boolean autoDifficulty,
        int difficultyLevel,
        boolean autoBalance,
        int balanceLevel,
        boolean autoAmount,
        double amountValue,
        boolean autoDiversity,
        int diversityLevel
) {

    private static final int DEFAULT_DIFFICULTY_LEVEL = 2;
    private static final int DEFAULT_BALANCE_LEVEL = 3;
    private static final double DEFAULT_AMOUNT_VALUE = 3.0;
    private static final int DEFAULT_DIVERSITY_LEVEL = 3;

    public EncounterTuningSettings {
        difficultyLevel = difficultyLevel < 1 || difficultyLevel > 4
                ? DEFAULT_DIFFICULTY_LEVEL : difficultyLevel;
        balanceLevel = balanceLevel < 1 || balanceLevel > 5
                ? DEFAULT_BALANCE_LEVEL : balanceLevel;
        amountValue = !Double.isFinite(amountValue) || amountValue < 1.0 || amountValue > 5.0
                ? DEFAULT_AMOUNT_VALUE : amountValue;
        diversityLevel = diversityLevel < 1 || diversityLevel > 4
                ? DEFAULT_DIVERSITY_LEVEL : diversityLevel;
    }

    public static EncounterTuningSettings defaults() {
        return new EncounterTuningSettings(
                true, DEFAULT_DIFFICULTY_LEVEL,
                true, DEFAULT_BALANCE_LEVEL,
                true, DEFAULT_AMOUNT_VALUE,
                true, DEFAULT_DIVERSITY_LEVEL);
    }
}
