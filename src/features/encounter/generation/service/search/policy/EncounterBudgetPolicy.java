package features.encounter.generation.service.search.policy;

import features.encounter.generation.service.EncounterDifficultyBand;
import features.encounter.generation.service.EncounterGenerator;
import features.encounter.generation.service.EncounterTuning;
import features.encounter.generation.service.EncounterTuning.CompositionTargets;
import features.encounter.generation.service.GenerationContext;
import features.encounter.generation.service.search.model.EncounterBudgets.BalanceProfile;
import features.encounter.generation.service.search.model.EncounterBudgets.BalanceShape;
import features.encounter.generation.service.search.model.EncounterBudgets.CompositionProfile;
import features.encounter.generation.service.search.model.EncounterBudgets.DistinctCreatureBudget;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.SearchHeuristics;
import features.encounter.rules.EncounterRules;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;

/**
 * Computes difficulty-derived pacing, action, and composition budgets.
 *
 * <p>The generator exposes three separate roster-shape controls:
 * difficulty picks the XP band, amount picks boss-vs-minion composition,
 * balance picks CR spread, and diversity picks the desired statblock count.
 * This policy keeps those concerns separate so each slider does one job.
 */
public final class EncounterBudgetPolicy {
    private EncounterBudgetPolicy() {
        throw new AssertionError("No instances");
    }

    /**
     * Resolves the request into one search budget snapshot.
     *
     * <p>Design intent:
     * difficulty determines encounter danger, amount determines creature-count/composition shape,
     * balance determines whether CR values should cluster or fan out, and diversity determines how
     * many distinct statblocks the search should target.
     */
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
        int resolvedDiversityLevel = EncounterTuning.resolveDiversityLevel(request.diversityLevel(), context);
        EncounterTuning.DifficultyBandBudgetRange bandBudgetRange =
                EncounterTuning.difficultyBandBudgetRange(avgLevel, partySize, difficultyBand);
        int targetAdjustedXp = midpointAdjustedXp(
                bandBudgetRange.lowerAdjustedXp(),
                bandBudgetRange.upperAdjustedXp());
        DistinctCreatureBudget distinctCreatureBudget = distinctCreatureBudget(resolvedDiversityLevel);
        CompositionTargets compositionTargets = EncounterTuning.compositionTargetsForAmount(
                resolvedAmountValue,
                partySize,
                distinctCreatureBudget.targetDistinctCreatures());
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
                resolvedDiversityLevel,
                compositionTargets.targetCreatureCount(),
                compositionTargets.creatureCountTolerance(),
                targetMonsterTurnSlots,
                softMonsterTurnSlots,
                hardMonsterTurnSlots,
                4,
                balanceProfile(resolvedBalanceLevel),
                distinctCreatureBudget,
                new CompositionProfile(
                        compositionTargets.bossPreference(),
                        compositionTargets.regularPreference(),
                        compositionTargets.minionPreference(),
                        compositionTargets.targetCreatureCount(),
                        compositionTargets.creatureCountTolerance()),
                defaultHeuristics());
    }

    private static SearchHeuristics defaultHeuristics() {
        return new SearchHeuristics(
                72,
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

    /**
     * Balance intentionally does not influence the XP target inside the chosen difficulty band.
     * Difficulty controls the band; balance only controls CR spread inside the generated roster.
     */
    private static int midpointAdjustedXp(int lowerAdjustedXp, int upperAdjustedXp) {
        if (upperAdjustedXp <= lowerAdjustedXp) {
            return lowerAdjustedXp;
        }
        return lowerAdjustedXp + (int) Math.round((upperAdjustedXp - lowerAdjustedXp) * 0.50);
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

    private static BalanceProfile balanceProfile(int balanceLevel) {
        return switch (balanceLevel) {
            case 1 -> new BalanceProfile(BalanceShape.ENDS_EXTREME, 2.0, Double.POSITIVE_INFINITY);
            case 2 -> new BalanceProfile(BalanceShape.ENDS_SOFT, 1.6, 3.0);
            case 4 -> new BalanceProfile(BalanceShape.PEERS_SOFT, 1.5, 1.8);
            case 5 -> new BalanceProfile(BalanceShape.PEERS_EXTREME, 1.35, 1.35);
            default -> new BalanceProfile(BalanceShape.NEUTRAL, 1.0, Double.POSITIVE_INFINITY);
        };
    }

    /**
     * Diversity controls how many different statblocks the generator should aim to combine.
     * Higher settings broaden the target roster instead of making the encounter harder.
     */
    private static DistinctCreatureBudget distinctCreatureBudget(int diversityLevel) {
        return switch (diversityLevel) {
            case 1 -> new DistinctCreatureBudget(1, 1, 2);
            case 2 -> new DistinctCreatureBudget(2, 2, 3);
            case 3 -> new DistinctCreatureBudget(2, 3, 4);
            default -> new DistinctCreatureBudget(3, 4, 4);
        };
    }
}
