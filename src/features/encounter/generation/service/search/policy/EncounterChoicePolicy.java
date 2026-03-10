package features.encounter.generation.service.search.policy;

import features.partyanalysis.model.EncounterWeightClass;
import features.encounter.generation.service.search.model.CandidateChoice;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.rules.EncounterRules;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Owns branch generation, count windows, and candidate scoring.
 */
public final class EncounterChoicePolicy {
    public static final int MAX_BRANCHES_PER_DEPTH = 24;

    private EncounterChoicePolicy() {
        throw new AssertionError("No instances");
    }

    public static List<CandidateChoice> buildChoices(
            SearchState state,
            List<CandidateEntry> entries,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            Map<Long, Integer> selectionWeights) {
        List<CandidateChoice> options = new ArrayList<>(MAX_BRANCHES_PER_DEPTH);
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
            List<AllowedCount> counts = allowedCountsFor(entry, budgets, state, selectionWeight);
            for (AllowedCount allowed : counts) {
                SearchState next = allowed.nextState();
                if (!EncounterConstraintPolicy.passesHardConstraints(next, budgets, relaxation)) {
                    continue;
                }
                if (!EncounterConstraintPolicy.mayStillReachCompletion(next, entries, budgets, relaxation, selectionWeights)
                        && !EncounterConstraintPolicy.isViableFallback(next, budgets, relaxation)) {
                    continue;
                }
                double score = scoreChoice(state, next, entry, allowed.count(), budgets, relaxation);
                insertTopChoice(options, new CandidateChoice(entry, allowed.count(), next, score));
            }
        }
        return options;
    }

    public static List<AllowedCount> allowedCountsFor(
            CandidateEntry entry,
            EncounterBudgets budgets,
            SearchState state,
            int selectionWeight) {
        int min = minAllowedCount(entry);
        int max = maxAllowedCount(entry);
        List<AllowedCount> counts = new ArrayList<>();
        for (int count = min; count <= max; count++) {
            SearchState next = state.add(SearchState.Addition.of(entry, count, selectionWeight));
            if (next.enemyTurnSlots() > budgets.hardMonsterTurnSlots()) {
                continue;
            }
            if (next.adjustedXp() > budgets.upperAdjustedXp()) {
                continue;
            }
            if (next.complexActionCount() > budgets.maxComplexActions()) {
                continue;
            }
            if (next.estimatedRounds(budgets.party().actionsPerRound()) > budgets.hardRounds() + 1.5) {
                continue;
            }
            counts.add(new AllowedCount(count, next));
        }
        if (counts.isEmpty()) {
            return counts;
        }

        List<AllowedCount> preferred = new ArrayList<>();
        int minPreferred = preferredMinCount(entry);
        int maxPreferred = preferredMaxCount(entry);
        for (AllowedCount allowed : counts) {
            if (allowed.count() >= minPreferred && allowed.count() <= maxPreferred) {
                preferred.add(allowed);
            }
        }
        return preferred.isEmpty() ? counts : preferred;
    }

    public static double scoreChoice(
            SearchState current,
            SearchState next,
            CandidateEntry entry,
            int count,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        double baseScore = scoreState(next, budgets, relaxation);
        double actionNeed = Math.max(0.0, budgets.minEnemyActionUnits() - current.enemyActionUnits());
        double actionGain = next.enemyActionUnits() - current.enemyActionUnits();
        double actionProgressBonus = actionNeed <= 0.0
                ? 1.0
                : 1.0 + (actionGain / Math.max(0.25, actionNeed));
        double classBonus = switch (entry.weightClass()) {
            case MINION -> actionNeed > 0.5 ? 1.15 : 0.95;
            case BOSS -> current.isEmpty() ? 1.12 : 0.92;
            case REGULAR -> 1.0;
        };
        double countFit = 1.0 / (1.0 + Math.abs(preferredMidCount(entry) - count));
        return baseScore * actionProgressBonus * classBonus * countFit;
    }

    public static double scoreState(
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        if (state == null || state.isEmpty()) {
            return 0.0;
        }
        double xpFit = xpFit(state.adjustedXp(), budgets);
        double targetEnemyActionUnits = (budgets.minEnemyActionUnits() + budgets.maxEnemyActionUnits()) * 0.5;
        double actionFit = closenessScore(state.enemyActionUnits(), targetEnemyActionUnits,
                Math.max(0.5, budgets.maxEnemyActionUnits() - budgets.minEnemyActionUnits()));
        double roundFit = closenessScore(
                state.estimatedRounds(budgets.party().actionsPerRound()),
                budgets.targetRounds(),
                Math.max(0.5, budgets.hardRounds() - budgets.targetRounds() + relaxation.pacingSlackRounds()));
        double turnFit = closenessScore(
                state.enemyTurnSlots(),
                budgets.targetMonsterTurnSlots(),
                Math.max(1.0, budgets.softMonsterTurnSlots() - budgets.targetMonsterTurnSlots() + 1.0));
        double creatureCountFit = creatureCountFit(state.totalCreatureCount(), budgets);
        double diversityFit = state.hasUniquePrimaryRoles() ? 1.08 : 0.72;
        double weightFit = selectionWeightFit(state);
        return xpFit * actionFit * roundFit * turnFit * creatureCountFit * diversityFit * weightFit;
    }

    public static int preferredMinCount(CandidateEntry entry) {
        return switch (entry.weightClass()) {
            case MINION -> 4;
            case REGULAR -> 2;
            case BOSS -> 1;
        };
    }

    public static int preferredMidCount(CandidateEntry entry) {
        return switch (entry.weightClass()) {
            case MINION -> 6;
            case REGULAR -> 3;
            case BOSS -> 1;
        };
    }

    public static int preferredMaxCount(CandidateEntry entry) {
        return switch (entry.weightClass()) {
            case MINION -> EncounterRules.MAX_CREATURES_PER_SLOT;
            case REGULAR -> 6;
            case BOSS -> 2;
        };
    }

    public static int minAllowedCount(CandidateEntry entry) {
        return switch (entry.weightClass()) {
            case MINION -> EncounterRules.MOB_MIN_SIZE;
            case REGULAR, BOSS -> 1;
        };
    }

    public static int maxAllowedCount(CandidateEntry entry) {
        return switch (entry.weightClass()) {
            case MINION -> EncounterRules.MAX_CREATURES_PER_SLOT;
            case REGULAR -> 6;
            case BOSS -> 2;
        };
    }

    private static double xpFit(int adjustedXp, EncounterBudgets budgets) {
        double bandTolerance = Math.max(75.0, (budgets.upperAdjustedXp() - budgets.lowerAdjustedXp()) * 0.25);
        double fit = closenessScore(adjustedXp, budgets.targetAdjustedXp(), bandTolerance);
        if (adjustedXp < budgets.lowerAdjustedXp()) {
            double deficit = budgets.lowerAdjustedXp() - adjustedXp;
            return fit * (1.0 / (1.0 + deficit / bandTolerance));
        }
        if (adjustedXp > budgets.upperAdjustedXp()) {
            double overflow = adjustedXp - budgets.upperAdjustedXp();
            return fit * (1.0 / (1.0 + overflow / bandTolerance));
        }
        return fit * 1.15;
    }

    private static double creatureCountFit(int totalCreatureCount, EncounterBudgets budgets) {
        if (budgets.targetCreatureCount() == Integer.MAX_VALUE) {
            double scale = Math.max(2.0, budgets.party().partySize() * 2.0);
            return 1.0 + Math.min(0.35, totalCreatureCount / scale * 0.10);
        }
        return closenessScore(
                totalCreatureCount,
                budgets.targetCreatureCount(),
                Math.max(1.0, budgets.creatureCountTolerance()));
    }

    private static double selectionWeightFit(SearchState state) {
        double averageSelectionWeight = state.averageSelectionWeight();
        return 1.0 + Math.min(0.35, Math.max(0.0, averageSelectionWeight - 1.0) * 0.08);
    }

    private static double closenessScore(double actual, double target, double tolerance) {
        return 1.0 / (1.0 + (Math.abs(actual - target) / Math.max(0.25, tolerance)));
    }

    private static void insertTopChoice(List<CandidateChoice> options, CandidateChoice candidate) {
        int insertAt = options.size();
        while (insertAt > 0 && options.get(insertAt - 1).score() < candidate.score()) {
            insertAt--;
        }
        if (insertAt >= MAX_BRANCHES_PER_DEPTH) {
            return;
        }
        options.add(insertAt, candidate);
        if (options.size() > MAX_BRANCHES_PER_DEPTH) {
            options.remove(options.size() - 1);
        }
    }

    public record AllowedCount(int count, SearchState nextState) {}
}
