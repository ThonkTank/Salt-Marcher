package features.encounter.generation.service.search.model;

/**
 * Request-scoped tuning knobs for encounter search behavior.
 */
public record SearchHeuristics(
        int shortlistLimit,
        int maxChoicesPerState,
        int seedWorkBudgetSharePercent,
        int maxBacktracksPerAttempt,
        double fallbackMinXpFactor,
        double fallbackMinActionUnitsFactor,
        double optimisticXpProgressWeight,
        double optimisticActionProgressWeight,
        double optimisticCreatureProgressWeight,
        double compositionPreferenceBiasThreshold,
        double compositionBiasTolerance,
        double minionActionUnitMultiplier,
        double leaderRoundsBonus,
        double supportRoundsBonus,
        double controllerRoundsBonus,
        double healingRoundsBonus
) {
    public static SearchHeuristics runtimeDefaults() {
        return new SearchHeuristics(
                40,
                8,
                15,
                2,
                0.80,
                0.72,
                1.2,
                1.1,
                0.60,
                0.25,
                0.20,
                0.5,
                0.12,
                0.12,
                0.06,
                0.04);
    }
}
