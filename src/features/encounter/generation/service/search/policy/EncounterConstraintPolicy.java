package features.encounter.generation.service.search.policy;

import features.partyanalysis.model.EncounterWeightClass;
import features.encounter.generation.service.EncounterSearchMetrics;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.StateEntry;
import features.encounter.rules.EncounterRules;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Owns hard-completion checks and optimistic feasibility pruning.
 *
 * <p>Public callers should use {@link #evaluateState(SearchState, EncounterBudgets, RelaxationProfile)},
 * {@link #isComplete(SearchState, EncounterBudgets, RelaxationProfile)}, and
 * {@link #mayStillReachCompletion(SearchState, List, EncounterBudgets, RelaxationProfile, Map)}.
 */
public final class EncounterConstraintPolicy {
    public static final int MAX_DIFFERENT_CREATURES = 4;

    private EncounterConstraintPolicy() {
        throw new AssertionError("No instances");
    }

    public record ConstraintEvaluation(
            boolean allowsGrowth,
            boolean isComplete,
            boolean isViableFallback
    ) {}

    public static ConstraintEvaluation evaluateState(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        boolean allowsGrowth = passesGrowthBounds(state, budgets, relaxation);
        if (!allowsGrowth) {
            return new ConstraintEvaluation(false, false, false);
        }
        boolean complete = passesCompletionBounds(state, budgets, relaxation);
        boolean viableFallback = passesFallbackBounds(state, budgets, relaxation);
        return new ConstraintEvaluation(true, complete, viableFallback);
    }

    public static boolean mayStillReachCompletion(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights) {
        if (!evaluateState(state, budgets, relaxation).allowsGrowth()) {
            return false;
        }
        if (isComplete(state, budgets, relaxation)) {
            return true;
        }
        int remainingDistinct = maxDistinctCreatures(budgets) - state.distinctStatBlocks();
        if (remainingDistinct <= 0) {
            return false;
        }
        if (!canStillSatisfyBalanceProfile(state, entries, budgets, relaxation, selectionWeights, remainingDistinct)) {
            return false;
        }

        SearchState optimistic = state;
        for (int i = 0; i < remainingDistinct; i++) {
            SearchState bestNext = null;
            double bestProgress = Double.NEGATIVE_INFINITY;
            for (CandidateEntry entry : reachableRemainingEntries(
                    optimistic, entries, budgets, relaxation, selectionWeights)) {
                if (optimistic.containsCreature(entry.creature().Id)) {
                    continue;
                }
                if (!relaxation.allowRoleRepeat()
                        && entry.primaryRole() != null
                        && optimistic.usesPrimaryRole(entry.primaryRole())) {
                    continue;
                }
                int selectionWeight = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
                for (int count : optimisticCountsFor(entry, budgets)) {
                    SearchState next = optimistic.add(
                            EncounterSearchMetrics.additionFor(entry, count, selectionWeight, budgets.heuristics()));
                    if (!evaluateState(next, budgets, relaxation).allowsGrowth()) {
                        continue;
                    }
                    double progress = optimisticProgressScore(optimistic, next, budgets, relaxation);
                    if (progress > bestProgress) {
                        bestProgress = progress;
                        bestNext = next;
                    }
                }
            }
            if (bestNext == null) {
                return false;
            }
            optimistic = bestNext;
            if (isComplete(optimistic, budgets, relaxation)) {
                return true;
            }
        }
        return isComplete(optimistic, budgets, relaxation);
    }

    public static boolean isComplete(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        return evaluateState(state, budgets, relaxation).isComplete();
    }

    public static boolean isViableFallback(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        return evaluateState(state, budgets, relaxation).isViableFallback();
    }

    /**
     * Balance governs CR spread only.
     *
     * <p>Extreme settings intentionally stay permissive during branch growth because a branch may
     * start with a regular creature and only discover its boss or weak outlier later. Completion
     * and reachability checks enforce the final shape more reliably than first-pick filtering.
     */
    public static boolean matchesBalanceDirection(
            SearchState state,
            CandidateEntry entry,
            EncounterBudgets budgets) {
        EncounterBudgets.BalanceProfile profile = budgets.balanceProfile();
        if (profile == null || profile.shape() == EncounterBudgets.BalanceShape.NEUTRAL) {
            return true;
        }

        int candidateXp = entry.creature().XP;
        int highestExistingXp = highestCreatureXp(state);
        int lowestExistingXp = lowestCreatureXp(state);

        return switch (profile.shape()) {
            case ENDS_EXTREME, ENDS_SOFT -> true;
            case PEERS_SOFT, PEERS_EXTREME -> state.isEmpty()
                    || fitsPeerBand(candidateXp, state, profile.maxPeerXpRatio());
            case NEUTRAL -> true;
        };
    }

    public static boolean matchesCompositionDirection(
            SearchState state,
            CandidateEntry entry,
            EncounterBudgets budgets) {
        EncounterBudgets.CompositionProfile profile = budgets.compositionProfile();
        if (profile == null || state.isEmpty()) {
            return true;
        }
        double candidatePreference = weightClassPreference(entry.weightClass(), profile);
        double currentBias = currentCompositionBias(state, profile);
        if (state.totalCreatureCount() >= profile.targetCreatureCount() + profile.creatureCountTolerance()) {
            return entry.weightClass() != EncounterWeightClass.MINION;
        }
        if (state.totalCreatureCount() + state.distinctStatBlocks() < profile.targetCreatureCount()) {
            return candidatePreference >= 0.85 || entry.weightClass() == EncounterWeightClass.REGULAR;
        }
        return candidatePreference + budgets.heuristics().compositionBiasTolerance() >= currentBias;
    }

    private static boolean passesGrowthBounds(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        return state.adjustedXp() <= budgets.upperAdjustedXp()
                && state.enemyActionUnits() <= budgets.maxEnemyActionUnits() + 0.25
                && state.enemyTurnSlots() <= budgets.hardMonsterTurnSlots()
                && state.distinctStatBlocks() <= maxDistinctCreatures(budgets)
                && state.complexActionCount() <= budgets.maxComplexActions()
                && matchesCurrentBalanceProfile(state, budgets)
                && EncounterSearchMetrics.estimatedRounds(state, budgets.party().actionsPerRound(), budgets.heuristics())
                <= budgets.hardRounds() + relaxation.pacingSlackRounds();
    }

    private static boolean passesCompletionBounds(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        if (state.isEmpty()) {
            return false;
        }
        if (state.distinctStatBlocks() < minDistinctCreatures(budgets)) {
            return false;
        }
        if (state.adjustedXp() < budgets.lowerAdjustedXp()) {
            return false;
        }
        if (state.enemyActionUnits() < budgets.minEnemyActionUnits()) {
            return false;
        }
        if (!matchesCompleteBalanceProfile(state, budgets)) {
            return false;
        }
        return relaxation.allowRoleRepeat() || state.hasUniquePrimaryRoles();
    }

    private static boolean passesFallbackBounds(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        if (state.isEmpty()) {
            return false;
        }
        if (state.distinctStatBlocks() < minDistinctCreatures(budgets)) {
            return false;
        }
        if (!passesGrowthBounds(state, budgets, relaxation)) {
            return false;
        }
        if (state.adjustedXp() < budgets.lowerAdjustedXp() * budgets.heuristics().fallbackMinXpFactor()) {
            return false;
        }
        return state.enemyActionUnits() >= budgets.minEnemyActionUnits() * budgets.heuristics().fallbackMinActionUnitsFactor()
                && matchesCompleteBalanceProfile(state, budgets);
    }

    private static double optimisticProgressScore(
            SearchState current,
            SearchState next,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        double currentXpDeficit = Math.max(0.0, budgets.lowerAdjustedXp() - current.adjustedXp());
        double nextXpDeficit = Math.max(0.0, budgets.lowerAdjustedXp() - next.adjustedXp());
        double currentActionDeficit = Math.max(0.0, budgets.minEnemyActionUnits() - current.enemyActionUnits());
        double nextActionDeficit = Math.max(0.0, budgets.minEnemyActionUnits() - next.enemyActionUnits());
        double currentCreatureDeficit = creatureCountDeficit(current.totalCreatureCount(), budgets);
        double nextCreatureDeficit = creatureCountDeficit(next.totalCreatureCount(), budgets);

        double xpProgress = currentXpDeficit - nextXpDeficit;
        double actionProgress = currentActionDeficit - nextActionDeficit;
        double creatureProgress = currentCreatureDeficit - nextCreatureDeficit;
        double weightClassProgress = weightClassProgress(current, next, budgets);
        return xpProgress * budgets.heuristics().optimisticXpProgressWeight()
                + actionProgress * budgets.heuristics().optimisticActionProgressWeight()
                + creatureProgress * budgets.heuristics().optimisticCreatureProgressWeight()
                + weightClassProgress;
    }

    private static boolean matchesCurrentBalanceProfile(SearchState state, EncounterBudgets budgets) {
        EncounterBudgets.BalanceProfile profile = budgets.balanceProfile();
        if (profile == null || state.isEmpty()) {
            return true;
        }
        return switch (profile.shape()) {
            case PEERS_SOFT, PEERS_EXTREME -> peerSpreadRatio(state) <= profile.maxPeerXpRatio();
            default -> true;
        };
    }

    private static boolean matchesCompleteBalanceProfile(SearchState state, EncounterBudgets budgets) {
        EncounterBudgets.BalanceProfile profile = budgets.balanceProfile();
        if (profile == null || state.isEmpty()) {
            return true;
        }
        return switch (profile.shape()) {
            case ENDS_EXTREME -> stateHasDominantCreature(state, profile.dominantXpRatio());
            case ENDS_SOFT -> stateHasDominantCreature(state, profile.dominantXpRatio() * 0.85)
                    || peerSpreadRatio(state) >= profile.dominantXpRatio();
            case PEERS_SOFT, PEERS_EXTREME -> peerSpreadRatio(state) <= profile.maxPeerXpRatio();
            case NEUTRAL -> true;
        };
    }

    private static boolean canStillSatisfyBalanceProfile(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights,
            int remainingDistinct) {
        EncounterBudgets.BalanceProfile profile = budgets.balanceProfile();
        if (profile == null || profile.shape() == EncounterBudgets.BalanceShape.NEUTRAL) {
            return true;
        }
        if (profile.shape() == EncounterBudgets.BalanceShape.PEERS_SOFT
                || profile.shape() == EncounterBudgets.BalanceShape.PEERS_EXTREME) {
            return matchesCurrentBalanceProfile(state, budgets);
        }
        if (stateHasDominantCreature(state, profile.dominantXpRatio())) {
            return true;
        }
        if (remainingDistinct <= 0) {
            return false;
        }
        int highestExistingXp = highestCreatureXp(state);
        int lowestExistingXp = lowestCreatureXp(state);
        if (state.isEmpty()) {
            return true;
        }
        for (CandidateEntry entry : entries) {
            if (state.containsCreature(entry.creature().Id)) {
                continue;
            }
            if (!relaxation.allowRoleRepeat()
                    && entry.primaryRole() != null
                    && state.usesPrimaryRole(entry.primaryRole())) {
                continue;
            }
            int selectionWeight = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
            for (int count : optimisticCountsFor(entry, budgets)) {
                SearchState next = state.add(
                        EncounterSearchMetrics.additionFor(entry, count, selectionWeight, budgets.heuristics()));
                if (!evaluateState(next, budgets, relaxation).allowsGrowth()) {
                    continue;
                }
                int candidateXp = entry.creature().XP;
                if (candidateXp >= Math.max(1, highestExistingXp * profile.dominantXpRatio())
                        || candidateXp <= Math.max(1, lowestExistingXp / profile.dominantXpRatio())
                        || stateHasDominantCreature(next, profile.dominantXpRatio())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Reachability checks must examine the full feasible set rather than the first N entries in
     * input order. Otherwise a later outlier can be incorrectly treated as unreachable.
     */
    private static List<CandidateEntry> reachableRemainingEntries(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights) {
        List<CandidateEntry> feasibleEntries = new ArrayList<>();
        for (CandidateEntry entry : entries) {
            if (state.containsCreature(entry.creature().Id)) {
                continue;
            }
            if (!relaxation.allowRoleRepeat()
                    && entry.primaryRole() != null
                    && state.usesPrimaryRole(entry.primaryRole())) {
                continue;
            }
            int selectionWeight = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
            boolean feasible = false;
            for (int count : optimisticCountsFor(entry, budgets)) {
                SearchState next = state.add(
                        EncounterSearchMetrics.additionFor(entry, count, selectionWeight, budgets.heuristics()));
                if (!evaluateState(next, budgets, relaxation).allowsGrowth()) {
                    continue;
                }
                feasible = true;
                break;
            }
            if (feasible) {
                feasibleEntries.add(entry);
            }
        }
        return feasibleEntries;
    }

    private static int[] optimisticCountsFor(CandidateEntry entry, EncounterBudgets budgets) {
        int min = EncounterChoicePolicy.minAllowedCount(entry);
        int mid = Math.max(min, Math.min(EncounterChoicePolicy.preferredMidCount(entry, budgets), EncounterChoicePolicy.maxAllowedCount(entry)));
        int max = EncounterChoicePolicy.maxAllowedCount(entry);
        if (min == mid && mid == max) {
            return new int[]{min};
        }
        if (min == mid) {
            return new int[]{min, max};
        }
        if (mid == max) {
            return new int[]{min, mid};
        }
        return new int[]{min, mid, max};
    }

    private static double creatureCountDeficit(int totalCreatureCount, EncounterBudgets budgets) {
        return Math.max(0.0, budgets.compositionProfile().targetCreatureCount() - totalCreatureCount);
    }

    private static double weightClassProgress(
            SearchState current,
            SearchState next,
            EncounterBudgets budgets) {
        double progress = 0.0;
        if (prefersMinions(budgets)
                && countByWeightClass(current, EncounterWeightClass.MINION) == 0
                && countByWeightClass(next, EncounterWeightClass.MINION) > 0) {
            progress += 0.9;
        }
        if (prefersBosses(budgets)
                && countByWeightClass(current, EncounterWeightClass.BOSS) == 0
                && countByWeightClass(next, EncounterWeightClass.BOSS) > 0) {
            progress += 0.8;
        }
        progress += compositionFit(next, budgets) - compositionFit(current, budgets);
        return progress;
    }

    /**
     * Ranks discovered states for fallback selection.
     *
     * <p>The generator prefers exact matches, then viable near-misses, and only then weaker
     * partial states. This lets the running game receive "the best encounter found so far"
     * instead of a false hard failure after the search has already made useful progress.
     */
    public static double outcomeScore(SearchState state, EncounterBudgets budgets, RelaxationProfile relaxation) {
        if (state == null || state.isEmpty()) {
            return Double.NEGATIVE_INFINITY;
        }
        double score = 0.0;
        score -= Math.abs(state.distinctStatBlocks() - budgets.distinctCreatureBudget().targetDistinctCreatures()) * 40.0;
        score -= Math.abs(budgets.targetAdjustedXp() - state.adjustedXp()) / 20.0;
        double targetActions = (budgets.minEnemyActionUnits() + budgets.maxEnemyActionUnits()) * 0.5;
        score -= Math.abs(targetActions - state.enemyActionUnits()) * 14.0;
        score -= Math.abs(budgets.compositionProfile().targetCreatureCount() - state.totalCreatureCount()) * 6.0;
        score += compositionFit(state, budgets) * 24.0;
        if (matchesCompleteBalanceProfile(state, budgets)) {
            score += 18.0;
        }
        if (isComplete(state, budgets, relaxation)) {
            score += 80.0;
        } else if (isViableFallback(state, budgets, relaxation)) {
            score += 24.0;
        }
        return score;
    }

    private static int countByWeightClass(SearchState state, EncounterWeightClass weightClass) {
        int total = 0;
        for (StateEntry entry : state.entries()) {
            if (entry.entry().weightClass() == weightClass) {
                total += entry.count();
            }
        }
        return total;
    }

    private static boolean stateHasDominantCreature(SearchState state, double dominantXpRatio) {
        if (state.entries().size() < 2) {
            return false;
        }
        int highestXp = highestCreatureXp(state);
        int secondHighestXp = secondHighestCreatureXp(state);
        return secondHighestXp > 0 && highestXp >= Math.ceil(secondHighestXp * dominantXpRatio);
    }

    private static boolean fitsPeerBand(int candidateXp, SearchState state, double maxPeerXpRatio) {
        for (StateEntry entry : state.entries()) {
            int existingXp = entry.entry().creature().XP;
            int high = Math.max(existingXp, candidateXp);
            int low = Math.max(1, Math.min(existingXp, candidateXp));
            if (high / (double) low > maxPeerXpRatio) {
                return false;
            }
        }
        return true;
    }

    private static double peerSpreadRatio(SearchState state) {
        int highestXp = highestCreatureXp(state);
        int lowestXp = lowestCreatureXp(state);
        if (highestXp <= 0 || lowestXp <= 0) {
            return 1.0;
        }
        return highestXp / (double) lowestXp;
    }

    private static int highestCreatureXp(SearchState state) {
        int highest = 0;
        for (StateEntry entry : state.entries()) {
            highest = Math.max(highest, entry.entry().creature().XP);
        }
        return highest;
    }

    private static int secondHighestCreatureXp(SearchState state) {
        int highest = 0;
        int secondHighest = 0;
        for (StateEntry entry : state.entries()) {
            int xp = entry.entry().creature().XP;
            if (xp >= highest) {
                secondHighest = highest;
                highest = xp;
            } else if (xp > secondHighest) {
                secondHighest = xp;
            }
        }
        return secondHighest;
    }

    private static int lowestCreatureXp(SearchState state) {
        int lowest = Integer.MAX_VALUE;
        for (StateEntry entry : state.entries()) {
            lowest = Math.min(lowest, entry.entry().creature().XP);
        }
        return lowest == Integer.MAX_VALUE ? 0 : lowest;
    }

    private static int minDistinctCreatures(EncounterBudgets budgets) {
        return budgets.distinctCreatureBudget() == null
                ? 1
                : Math.max(1, budgets.distinctCreatureBudget().minDistinctCreatures());
    }

    private static int maxDistinctCreatures(EncounterBudgets budgets) {
        return budgets.distinctCreatureBudget() == null
                ? MAX_DIFFERENT_CREATURES
                : Math.min(MAX_DIFFERENT_CREATURES, Math.max(1, budgets.distinctCreatureBudget().maxDistinctCreatures()));
    }

    private static boolean prefersBosses(EncounterBudgets budgets) {
        return budgets.compositionProfile() != null
                && budgets.compositionProfile().bossPreference()
                > budgets.compositionProfile().minionPreference() + budgets.heuristics().compositionPreferenceBiasThreshold();
    }

    private static boolean prefersMinions(EncounterBudgets budgets) {
        return budgets.compositionProfile() != null
                && budgets.compositionProfile().minionPreference()
                > budgets.compositionProfile().bossPreference() + budgets.heuristics().compositionPreferenceBiasThreshold();
    }

    private static double compositionFit(SearchState state, EncounterBudgets budgets) {
        EncounterBudgets.CompositionProfile profile = budgets.compositionProfile();
        if (profile == null || state.isEmpty()) {
            return 0.0;
        }
        int bossCount = countByWeightClass(state, EncounterWeightClass.BOSS);
        int regularCount = countByWeightClass(state, EncounterWeightClass.REGULAR);
        int minionCount = countByWeightClass(state, EncounterWeightClass.MINION);
        int total = Math.max(1, bossCount + regularCount + minionCount);
        double bossFit = 1.0 - Math.abs(profile.bossPreference() - bossCount / (double) total);
        double regularFit = 1.0 - Math.abs(profile.regularPreference() - regularCount / (double) total);
        double minionFit = 1.0 - Math.abs(profile.minionPreference() - minionCount / (double) total);
        return bossFit * 0.40 + regularFit * 0.20 + minionFit * 0.40;
    }

    private static double currentCompositionBias(SearchState state, EncounterBudgets.CompositionProfile profile) {
        if (state.isEmpty() || profile == null) {
            return 0.0;
        }
        return Math.max(
                countByWeightClass(state, EncounterWeightClass.BOSS) > 0 ? profile.bossPreference() : 0.0,
                Math.max(
                        countByWeightClass(state, EncounterWeightClass.REGULAR) > 0 ? profile.regularPreference() : 0.0,
                        countByWeightClass(state, EncounterWeightClass.MINION) > 0 ? profile.minionPreference() : 0.0));
    }

    private static double weightClassPreference(
            EncounterWeightClass weightClass,
            EncounterBudgets.CompositionProfile profile) {
        return switch (weightClass) {
            case BOSS -> profile.bossPreference();
            case REGULAR -> profile.regularPreference();
            case MINION -> profile.minionPreference();
        };
    }

}
