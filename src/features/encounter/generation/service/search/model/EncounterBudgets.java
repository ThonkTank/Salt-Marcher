package features.encounter.generation.service.search.model;

import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;

/**
 * Difficulty-derived pacing and complexity budgets for one generation request.
 */
public record EncounterBudgets(
        EncounterPartyBenchmarks party,
        int lowerAdjustedXp,
        int upperAdjustedXp,
        double targetRounds,
        double hardRounds,
        double minEnemyActionUnits,
        double maxEnemyActionUnits,
        int targetMonsterTurnSlots,
        int softMonsterTurnSlots,
        int hardMonsterTurnSlots,
        int maxComplexActions
) {}
