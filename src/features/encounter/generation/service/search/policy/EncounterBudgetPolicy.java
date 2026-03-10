package features.encounter.generation.service.search.policy;

import features.encounter.generation.service.EncounterDifficultyBand;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterTuning;
import features.encounter.generation.service.GenerationContext;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.rules.EncounterRules;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;

/**
 * Computes difficulty-derived pacing, action, and complexity budgets.
 */
public final class EncounterBudgetPolicy {
    private EncounterBudgetPolicy() {
        throw new AssertionError("No instances");
    }

    public static EncounterBudgets forRequest(
            EncounterGenerator.EncounterRequest request,
            int avgLevel,
            int partySize,
            EncounterPartyBenchmarks party,
            GenerationContext context) {
        EncounterDifficultyBand difficultyBand = EncounterTuning.resolveDifficultyBand(
                request.difficultyBand(),
                context);
        EncounterTuning.DifficultyBandBudgetRange bandBudgetRange =
                EncounterTuning.difficultyBandBudgetRange(avgLevel, partySize, difficultyBand);
        double bandWeight = bandWeight(difficultyBand);
        double targetRounds = 3.0 + (bandWeight * 2.5);
        double hardRounds = targetRounds + 0.75;
        double minEnemyActionUnits = party.actionsPerRound() * (0.72 + (bandWeight * 0.20));
        double maxEnemyActionUnits = party.actionsPerRound() * (1.08 + (bandWeight * 0.18));
        int hardMonsterTurnSlots = Math.max(1, EncounterRules.MAX_TOTAL_INIT_SLOTS - partySize);
        int softMonsterTurnSlots = Math.max(1, Math.min(hardMonsterTurnSlots, 8 - Math.min(5, partySize)));
        double hardComplexity = 2.25 + (partySize * 0.95) + (bandWeight * 2.0);
        double softComplexity = Math.max(1.5, hardComplexity - 1.5);
        return new EncounterBudgets(
                party,
                bandBudgetRange.lowerAdjustedXp(),
                bandBudgetRange.upperAdjustedXp(),
                targetRounds,
                hardRounds,
                minEnemyActionUnits,
                maxEnemyActionUnits,
                softMonsterTurnSlots,
                hardMonsterTurnSlots,
                softComplexity,
                hardComplexity);
    }

    private static double bandWeight(EncounterDifficultyBand difficultyBand) {
        return switch (difficultyBand) {
            case EASY -> 0.15;
            case MEDIUM -> 0.45;
            case HARD -> 0.72;
            case DEADLY -> 1.0;
        };
    }
}
