package features.encounter.generation.service.search.model;

import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;

/**
 * Difficulty-derived pacing and complexity budgets for one generation request.
 */
public record EncounterBudgets(
        EncounterPartyBenchmarks party,
        int lowerAdjustedXp,
        int upperAdjustedXp,
        int targetAdjustedXp,
        double targetRounds,
        double hardRounds,
        double minEnemyActionUnits,
        double maxEnemyActionUnits,
        int resolvedBalanceLevel,
        double resolvedAmountValue,
        int resolvedDiversityLevel,
        int targetCreatureCount,
        int creatureCountTolerance,
        int targetMonsterTurnSlots,
        int softMonsterTurnSlots,
        int hardMonsterTurnSlots,
        int maxComplexActions,
        BalanceProfile balanceProfile,
        DistinctCreatureBudget distinctCreatureBudget,
        CompositionProfile compositionProfile,
        SearchHeuristics heuristics
) {
    public enum BalanceShape {
        ENDS_EXTREME,
        ENDS_SOFT,
        NEUTRAL,
        PEERS_SOFT,
        PEERS_EXTREME
    }

    public record BalanceProfile(
            BalanceShape shape,
            double dominantXpRatio,
            double maxPeerXpRatio
    ) {}

    public record DistinctCreatureBudget(
            int minDistinctCreatures,
            int targetDistinctCreatures,
            int maxDistinctCreatures
    ) {}

    public record CompositionProfile(
            double bossPreference,
            double regularPreference,
            double minionPreference,
            int targetCreatureCount,
            int creatureCountTolerance
    ) {}
}
