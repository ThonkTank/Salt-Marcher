package features.encounter.generation.service.search.model;

/**
 * Request-scoped tuning knobs for encounter search behavior.
 */
public record SearchHeuristics(
        int shortlistLimit,
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
) {}
