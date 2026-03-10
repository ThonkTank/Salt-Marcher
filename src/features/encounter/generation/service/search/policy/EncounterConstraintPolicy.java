package features.encounter.generation.service.search.policy;

import features.creatures.model.CreatureCapabilityTag;
import features.creatures.model.EncounterFunctionRole;
import features.partyanalysis.model.EncounterWeightClass;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.OptimisticAddition;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.StateEntry;
import features.encounter.rules.EncounterRules;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.ToDoubleFunction;
import java.util.Set;

/**
 * Owns hard-completion checks and optimistic feasibility pruning.
 */
public final class EncounterConstraintPolicy {
    public static final int MAX_DIFFERENT_CREATURES = 4;

    private EncounterConstraintPolicy() {
        throw new AssertionError("No instances");
    }

    public static boolean passesHardConstraints(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        return state.adjustedXp() <= budgets.upperAdjustedXp()
                && state.enemyActionUnits() <= budgets.maxEnemyActionUnits() + 0.25
                && state.enemyTurnSlots() <= budgets.hardMonsterTurnSlots()
                && state.distinctStatBlocks() <= MAX_DIFFERENT_CREATURES
                && state.complexActionCount() <= budgets.maxComplexActions()
                && state.estimatedRounds(budgets.party().actionsPerRound())
                <= budgets.hardRounds() + relaxation.pacingSlackRounds();
    }

    public static boolean mayStillReachCompletion(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights) {
        if (!passesHardConstraints(state, budgets, relaxation)) {
            return false;
        }
        if (isComplete(state, budgets, relaxation)) {
            return true;
        }
        int remainingDistinct = MAX_DIFFERENT_CREATURES - state.distinctStatBlocks();
        if (remainingDistinct <= 0) {
            return false;
        }

        SearchState optimistic = state;
        for (int i = 0; i < remainingDistinct; i++) {
            SearchState bestNext = null;
            double bestProgress = Double.NEGATIVE_INFINITY;
            for (CandidateEntry entry : entries) {
                if (optimistic.containsCreature(entry.creature().Id)) {
                    continue;
                }
                if (!relaxation.allowRoleRepeat()
                        && entry.primaryRole() != null
                        && optimistic.usesPrimaryRole(entry.primaryRole())) {
                    continue;
                }
                int selectionWeight = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
                for (int count = EncounterChoicePolicy.minAllowedCount(entry);
                     count <= EncounterChoicePolicy.maxAllowedCount(entry);
                     count++) {
                    SearchState next = optimistic.add(SearchState.Addition.of(entry, count, selectionWeight));
                    if (!passesHardConstraints(next, budgets, relaxation)) {
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
        if (state.isEmpty()) {
            return false;
        }
        if (state.adjustedXp() < budgets.lowerAdjustedXp() || state.adjustedXp() > budgets.upperAdjustedXp()) {
            return false;
        }
        if (state.enemyActionUnits() < budgets.minEnemyActionUnits()
                || state.enemyActionUnits() > budgets.maxEnemyActionUnits() + 0.25) {
            return false;
        }
        if (state.enemyTurnSlots() > budgets.hardMonsterTurnSlots()) {
            return false;
        }
        if (state.complexActionCount() > budgets.maxComplexActions()) {
            return false;
        }
        if (state.estimatedRounds(budgets.party().actionsPerRound()) > budgets.hardRounds() + relaxation.pacingSlackRounds()) {
            return false;
        }
        return relaxation.allowRoleRepeat() || state.hasUniquePrimaryRoles();
    }

    public static boolean isViableFallback(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        if (state.isEmpty() || !passesHardConstraints(state, budgets, relaxation)) {
            return false;
        }
        if (state.adjustedXp() < budgets.lowerAdjustedXp() * 0.80) {
            return false;
        }
        return state.enemyActionUnits() >= budgets.minEnemyActionUnits() * 0.72;
    }

    public static OptimisticAddition bestOptimisticAddition(
            SearchState state,
            CandidateEntry entry,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            ToDoubleFunction<OptimisticAddition> metric) {
        OptimisticCandidates candidates = bestOptimisticAdditions(state, entry, budgets, relaxation, metric, metric);
        return candidates.bestPrimary();
    }

    public static OptimisticAddition bestOptimisticAddition(
            SearchState state,
            CandidateEntry entry,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        return bestOptimisticAdditions(state, entry, budgets, relaxation).bestPrimary();
    }

    private static OptimisticCandidates bestOptimisticAdditions(
            SearchState state,
            CandidateEntry entry,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            ToDoubleFunction<OptimisticAddition> primaryMetric,
            ToDoubleFunction<OptimisticAddition> secondaryMetric) {
        OptimisticAddition bestPrimary = null;
        OptimisticAddition bestSecondary = null;
        for (int count = 1; count <= EncounterChoicePolicy.preferredMaxCount(entry); count++) {
            if (count < EncounterChoicePolicy.minAllowedCount(entry)
                    || count > EncounterChoicePolicy.maxAllowedCount(entry)) {
                continue;
            }
            SearchState.Addition addition = SearchState.Addition.of(entry, count);
            SearchState next = state.add(addition);
            if (!passesHardConstraints(next, budgets, relaxation)) {
                continue;
            }

            OptimisticAddition candidate = new OptimisticAddition(
                    count,
                    addition.rawXpDelta(),
                    addition.enemyActionUnitsDelta(),
                    addition.survivabilityActionsDelta(),
                    entry.primaryRole(),
                    addition.hasHealingCapability());
            if (isBetter(candidate, bestPrimary, primaryMetric, secondaryMetric)) {
                bestPrimary = candidate;
            }
            if (isBetter(candidate, bestSecondary, secondaryMetric, primaryMetric)) {
                bestSecondary = candidate;
            }
        }
        return new OptimisticCandidates(bestPrimary, bestSecondary);
    }

    private static OptimisticCandidates bestOptimisticAdditions(
            SearchState state,
            CandidateEntry entry,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        return bestOptimisticAdditions(state, entry, budgets, relaxation,
                addition -> addition.rawXp(),
                OptimisticAddition::actionUnits);
    }

    private static boolean isBetter(
            OptimisticAddition candidate,
            OptimisticAddition currentBest,
            ToDoubleFunction<OptimisticAddition> primaryMetric,
            ToDoubleFunction<OptimisticAddition> secondaryMetric) {
        return currentBest == null
                || primaryMetric.applyAsDouble(candidate) > primaryMetric.applyAsDouble(currentBest)
                || (primaryMetric.applyAsDouble(candidate) == primaryMetric.applyAsDouble(currentBest)
                && secondaryMetric.applyAsDouble(candidate) > secondaryMetric.applyAsDouble(currentBest));
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
        double stateScore = features.encounter.generation.service.search.policy.EncounterChoicePolicy
                .scoreState(next, budgets, relaxation);
        return xpProgress * 1.2 + actionProgress * 1.1 + creatureProgress * 0.35 + stateScore;
    }

    private static double creatureCountDeficit(int totalCreatureCount, EncounterBudgets budgets) {
        if (budgets.targetCreatureCount() == Integer.MAX_VALUE) {
            return 0.0;
        }
        return Math.max(0.0, budgets.targetCreatureCount() - totalCreatureCount);
    }

    public static double enemyActionContribution(CandidateEntry entry, int count) {
        double baseUnits = Math.max(0.25, entry.profile().actionUnitsPerRound());
        if (entry.weightClass() == EncounterWeightClass.MINION) {
            return count * Math.max(0.25, baseUnits * 0.5);
        }
        return count * baseUnits;
    }

    public static int encounterComplexActionContribution(CandidateEntry entry, int count) {
        return Math.max(0, entry.profile().complexActionCount()) * Math.max(0, count);
    }

    public static double supportRoundsMultiplier(
            Set<EncounterFunctionRole> primaryRoles,
            List<StateEntry> entries) {
        return supportRoundsMultiplier(primaryRoles, hasHealingCapability(entries));
    }

    public static double supportRoundsMultiplier(
            Set<EncounterFunctionRole> primaryRoles,
            boolean hasHealingCapability) {
        double multiplier = 1.0;
        if (primaryRoles.contains(EncounterFunctionRole.LEADER)) {
            multiplier += 0.12;
        }
        if (primaryRoles.contains(EncounterFunctionRole.SUPPORT)) {
            multiplier += 0.12;
        }
        if (primaryRoles.contains(EncounterFunctionRole.CONTROLLER)) {
            multiplier += 0.06;
        }
        if (hasHealingCapability) {
            multiplier += 0.04;
        }
        return multiplier;
    }

    public static boolean hasHealingCapability(List<StateEntry> entries) {
        for (StateEntry entry : entries) {
            if (hasHealingCapability(entry.entry())) {
                return true;
            }
        }
        return false;
    }

    public static boolean hasHealingCapability(CandidateEntry entry) {
        return entry.profile().capabilityTags().contains(CreatureCapabilityTag.HEALER);
    }

    private record OptimisticCandidates(OptimisticAddition bestPrimary, OptimisticAddition bestSecondary) {
        private OptimisticAddition bestXp() {
            return bestPrimary;
        }

        private OptimisticAddition bestActions() {
            return bestSecondary;
        }
    }
}
