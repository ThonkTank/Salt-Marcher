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
        List<CandidateChoice> options = new ArrayList<>();
        for (CandidateEntry entry : entries) {
            if (state.containsCreature(entry.creature().Id)) {
                continue;
            }
            if (!relaxation.allowRoleRepeat()
                    && entry.primaryRole() != null
                    && state.usesPrimaryRole(entry.primaryRole())) {
                continue;
            }
            List<AllowedCount> counts = allowedCountsFor(entry, budgets, state);
            for (AllowedCount allowed : counts) {
                SearchState next = allowed.nextState();
                if (!EncounterConstraintPolicy.passesHardConstraints(next, budgets, relaxation)) {
                    continue;
                }
                if (!EncounterConstraintPolicy.canStillReachCompletion(next, entries, budgets, relaxation)) {
                    continue;
                }
                double score = scoreChoice(state, next, entry, allowed.count(), budgets, selectionWeights);
                options.add(new CandidateChoice(entry, allowed.count(), next, score));
            }
        }
        return options;
    }

    public static List<AllowedCount> allowedCountsFor(
            CandidateEntry entry,
            EncounterBudgets budgets,
            SearchState state) {
        int max = preferredMaxCount(entry);
        List<AllowedCount> counts = new ArrayList<>();
        for (int count = 1; count <= max; count++) {
            SearchState next = state.add(SearchState.Addition.of(entry, count));
            if (next.enemyTurnSlots() > budgets.hardMonsterTurnSlots()) {
                continue;
            }
            if (next.adjustedXp() > budgets.upperAdjustedXp()) {
                continue;
            }
            if (next.gmComplexityLoad() > budgets.hardComplexity() + 1.75) {
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
            Map<Long, Integer> selectionWeights) {
        double xpFit = xpBandFit(next.adjustedXp(), budgets.lowerAdjustedXp(), budgets.upperAdjustedXp());
        double actionNeed = Math.max(0.0, budgets.minEnemyActionUnits() - current.enemyActionUnits());
        double actionGain = next.enemyActionUnits() - current.enemyActionUnits();
        double actionFit = actionNeed <= 0.0
                ? 1.0 / (1.0 + Math.max(0.0, next.enemyActionUnits() - budgets.maxEnemyActionUnits()))
                : 1.0 + (actionGain / Math.max(0.25, actionNeed));
        double roundPenalty = 1.0 / (1.0 + Math.max(0.0,
                next.estimatedRounds(budgets.party().actionsPerRound()) - budgets.targetRounds()));
        double complexityPenalty = 1.0 / (1.0 + Math.max(0.0, next.gmComplexityLoad() - budgets.softComplexity()));
        double turnPenalty = 1.0 / (1.0 + Math.max(0, next.enemyTurnSlots() - budgets.softMonsterTurnSlots()));
        double weightBonus = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
        double classBonus = switch (entry.weightClass()) {
            case MINION -> actionNeed > 0.5 ? 1.15 : 0.95;
            case BOSS -> current.isEmpty() ? 1.12 : 0.92;
            case REGULAR -> 1.0;
        };
        double countFit = 1.0 / (1.0 + Math.abs(preferredMidCount(entry) - count));
        return xpFit * actionFit * roundPenalty * complexityPenalty * turnPenalty * classBonus * countFit * weightBonus;
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

    private static double xpBandFit(int adjustedXp, int lowerAdjustedXp, int upperAdjustedXp) {
        if (adjustedXp < lowerAdjustedXp) {
            return Math.max(0.2, adjustedXp / (double) Math.max(50, lowerAdjustedXp));
        }
        if (adjustedXp > upperAdjustedXp) {
            return 1.0 / (1.0 + ((adjustedXp - upperAdjustedXp) / (double) Math.max(50, upperAdjustedXp)));
        }
        return 1.2;
    }

    public record AllowedCount(int count, SearchState nextState) {}
}
