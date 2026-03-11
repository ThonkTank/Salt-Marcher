package features.encounter.generation.service.search.policy;

import features.encounter.generation.service.EncounterSearchMetrics;
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
            if (!EncounterConstraintPolicy.matchesBalanceDirection(state, entry, budgets)) {
                continue;
            }
            if (!EncounterConstraintPolicy.matchesCompositionDirection(state, entry, budgets)) {
                continue;
            }
            int selectionWeight = Math.max(1, selectionWeights.getOrDefault(entry.creature().Id, 1));
            for (CandidateChoice choice : buildChoicesForEntry(entry, state, budgets, relaxation, selectionWeight)) {
                SearchState next = choice.nextState();
                EncounterConstraintPolicy.ConstraintEvaluation evaluation =
                        EncounterConstraintPolicy.evaluateState(next, budgets, relaxation);
                if (!evaluation.allowsGrowth()) {
                    continue;
                }
                if (!EncounterConstraintPolicy.mayStillReachCompletion(next, entries, budgets, relaxation, selectionWeights)
                        && !evaluation.isViableFallback()) {
                    continue;
                }
                options.add(choice);
            }
        }
        return options;
    }

    public static List<CandidateChoice> buildChoicesForEntry(
            CandidateEntry entry,
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            int selectionWeight) {
        return candidateChoicesFor(entry, state, budgets, relaxation, selectionWeight);
    }

    private static List<CandidateChoice> candidateChoicesFor(
            CandidateEntry entry,
            SearchState state,
            EncounterBudgets budgets,
            RelaxationProfile relaxation,
            int selectionWeight) {
        int min = minAllowedCount(entry);
        int max = maxAllowedCount(entry);
        List<CandidateChoice> choices = new ArrayList<>();
        for (int count = min; count <= max; count++) {
            SearchState next = state.add(
                    EncounterSearchMetrics.additionFor(entry, count, selectionWeight, budgets.heuristics()));
            if (!EncounterConstraintPolicy.evaluateState(next, budgets, relaxation).allowsGrowth()) {
                continue;
            }
            choices.add(new CandidateChoice(entry, count, next));
        }
        if (choices.isEmpty()) {
            return choices;
        }

        List<CandidateChoice> preferred = new ArrayList<>();
        int minPreferred = preferredMinCount(entry, budgets);
        int maxPreferred = preferredMaxCount(entry, budgets);
        for (CandidateChoice choice : choices) {
            if (choice.count() >= minPreferred && choice.count() <= maxPreferred) {
                preferred.add(choice);
            }
        }
        return preferred.isEmpty() ? choices : preferred;
    }

    public static int preferredMinCount(CandidateEntry entry) {
        return preferredMinCount(entry, null);
    }

    public static int preferredMinCount(CandidateEntry entry, EncounterBudgets budgets) {
        return switch (entry.weightClass()) {
            case MINION -> prefersMinions(budgets) ? 5 : 4;
            case REGULAR -> 2;
            case BOSS -> 1;
        };
    }

    public static int preferredMidCount(CandidateEntry entry) {
        return preferredMidCount(entry, null);
    }

    public static int preferredMidCount(CandidateEntry entry, EncounterBudgets budgets) {
        return switch (entry.weightClass()) {
            case MINION -> prefersMinions(budgets) ? 7 : 6;
            case REGULAR -> 3;
            case BOSS -> prefersBosses(budgets) ? 2 : 1;
        };
    }

    public static int preferredMaxCount(CandidateEntry entry) {
        return preferredMaxCount(entry, null);
    }

    public static int preferredMaxCount(CandidateEntry entry, EncounterBudgets budgets) {
        return switch (entry.weightClass()) {
            case MINION -> EncounterRules.MAX_CREATURES_PER_SLOT;
            case REGULAR -> 6;
            case BOSS -> prefersBosses(budgets) ? 2 : 1;
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

    private static boolean prefersBosses(EncounterBudgets budgets) {
        return budgets != null && budgets.compositionProfile() != null
                && budgets.compositionProfile().bossPreference()
                > budgets.compositionProfile().minionPreference() + budgets.heuristics().compositionPreferenceBiasThreshold();
    }

    private static boolean prefersMinions(EncounterBudgets budgets) {
        return budgets != null && budgets.compositionProfile() != null
                && budgets.compositionProfile().minionPreference()
                > budgets.compositionProfile().bossPreference() + budgets.heuristics().compositionPreferenceBiasThreshold();
    }
}
