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
        int resolvedBalanceLevel = EncounterTuning.resolveLevel(request.balanceLevel(), context);
        double resolvedAmountValue = EncounterTuning.resolveAmountValue(request.amountValue(), partySize, context);
        EncounterTuning.DifficultyBandBudgetRange bandBudgetRange =
                EncounterTuning.difficultyBandBudgetRange(avgLevel, partySize, difficultyBand);
        int targetAdjustedXp = targetAdjustedXp(
                bandBudgetRange.lowerAdjustedXp(),
                bandBudgetRange.upperAdjustedXp(),
                resolvedBalanceLevel);
        int targetCreatureCount = EncounterTuning.targetCreaturesForAmount(resolvedAmountValue, partySize);
        int creatureCountTolerance = creatureCountTolerance(targetCreatureCount, partySize);
        double targetRounds = targetRounds(difficultyBand);
        double hardRounds = hardRounds(difficultyBand);
        double targetActionParity = targetActionParity(difficultyBand);
        double actionSlack = actionSlack(difficultyBand);
        double minEnemyActionUnits = party.actionsPerRound() * Math.max(0.5, targetActionParity - actionSlack);
        double maxEnemyActionUnits = party.actionsPerRound() * (targetActionParity + actionSlack);
        int hardMonsterTurnSlots = Math.max(1, EncounterRules.MAX_TOTAL_INIT_SLOTS - partySize);
        int targetMonsterTurnSlots = Math.max(1, Math.min(hardMonsterTurnSlots, 7 - Math.min(6, partySize)));
        int softMonsterTurnSlots = Math.max(1, Math.min(hardMonsterTurnSlots, targetMonsterTurnSlots + 1));
        return new EncounterBudgets(
                party,
                bandBudgetRange.lowerAdjustedXp(),
                bandBudgetRange.upperAdjustedXp(),
                targetAdjustedXp,
                targetRounds,
                hardRounds,
                minEnemyActionUnits,
                maxEnemyActionUnits,
                resolvedBalanceLevel,
                resolvedAmountValue,
                targetCreatureCount,
                creatureCountTolerance,
                targetMonsterTurnSlots,
                softMonsterTurnSlots,
                hardMonsterTurnSlots,
                4);
    }

    private static int targetAdjustedXp(int lowerAdjustedXp, int upperAdjustedXp, int balanceLevel) {
        if (upperAdjustedXp <= lowerAdjustedXp) {
            return lowerAdjustedXp;
        }
        double fraction = switch (balanceLevel) {
            case 1 -> 0.05;
            case 2 -> 0.30;
            case 3 -> 0.50;
            case 4 -> 0.70;
            default -> 0.95;
        };
        return lowerAdjustedXp + (int) Math.round((upperAdjustedXp - lowerAdjustedXp) * fraction);
    }

    private static int creatureCountTolerance(int targetCreatureCount, int partySize) {
        if (targetCreatureCount == Integer.MAX_VALUE) {
            return Math.max(2, partySize);
        }
        return Math.max(1, (int) Math.ceil(Math.max(1, targetCreatureCount) * 0.25));
    }

    private static double targetActionParity(EncounterDifficultyBand difficultyBand) {
        return switch (difficultyBand) {
            case EASY -> 0.80;
            case MEDIUM -> 1.00;
            case HARD -> 1.12;
            case DEADLY -> 1.28;
        };
    }

    private static double targetRounds(EncounterDifficultyBand difficultyBand) {
        return switch (difficultyBand) {
            case EASY -> 3.0;
            case MEDIUM -> 4.0;
            case HARD -> 5.0;
            case DEADLY -> 5.75;
        };
    }

    private static double hardRounds(EncounterDifficultyBand difficultyBand) {
        return switch (difficultyBand) {
            case EASY -> 3.5;
            case MEDIUM -> 4.5;
            case HARD -> 5.5;
            case DEADLY -> 6.0;
        };
    }

    private static double actionSlack(EncounterDifficultyBand difficultyBand) {
        return switch (difficultyBand) {
            case EASY -> 0.12;
            case MEDIUM -> 0.10;
            case HARD -> 0.12;
            case DEADLY -> 0.16;
        };
    }
}
