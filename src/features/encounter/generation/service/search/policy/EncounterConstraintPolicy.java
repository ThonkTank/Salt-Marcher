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
import java.util.Comparator;
import java.util.List;
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

    public static boolean canStillReachCompletion(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
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

        List<CandidateEntry> remaining = new ArrayList<>();
        for (CandidateEntry entry : entries) {
            if (state.containsCreature(entry.creature().Id)) {
                continue;
            }
            if (!relaxation.allowRoleRepeat()
                    && entry.primaryRole() != null
                    && state.usesPrimaryRole(entry.primaryRole())) {
                continue;
            }
            remaining.add(entry);
        }
        if (remaining.isEmpty()) {
            return false;
        }

        List<OptimisticAddition> optimisticXpAdditions = new ArrayList<>();
        List<OptimisticAddition> optimisticActionAdditions = new ArrayList<>();
        for (CandidateEntry entry : remaining) {
            OptimisticCandidates candidates = bestOptimisticAdditions(state, entry, budgets, relaxation);
            if (candidates.bestXp() != null) {
                optimisticXpAdditions.add(candidates.bestXp());
            }
            if (candidates.bestActions() != null) {
                optimisticActionAdditions.add(candidates.bestActions());
            }
        }
        if (optimisticXpAdditions.isEmpty() && optimisticActionAdditions.isEmpty()) {
            return false;
        }

        optimisticXpAdditions.sort(Comparator
                .comparingDouble((OptimisticAddition addition) -> addition.rawXp())
                .reversed());
        optimisticActionAdditions.sort(Comparator
                .comparingDouble(OptimisticAddition::actionUnits)
                .reversed());

        int optimisticRawXp = state.rawXp();
        int optimisticXpCount = state.totalCreatureCount();
        for (int i = 0; i < Math.min(remainingDistinct, optimisticXpAdditions.size()); i++) {
            OptimisticAddition addition = optimisticXpAdditions.get(i);
            optimisticRawXp += addition.rawXp();
            optimisticXpCount += addition.count();
        }

        double optimisticActions = state.enemyActionUnits();
        for (int i = 0; i < Math.min(remainingDistinct, optimisticActionAdditions.size()); i++) {
            OptimisticAddition addition = optimisticActionAdditions.get(i);
            optimisticActions += addition.actionUnits();
        }

        int optimisticAdjustedXp = EncounterScoring.applyMultiplier(optimisticRawXp, optimisticXpCount);

        return optimisticAdjustedXp >= budgets.lowerAdjustedXp()
                && optimisticActions >= budgets.minEnemyActionUnits();
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
