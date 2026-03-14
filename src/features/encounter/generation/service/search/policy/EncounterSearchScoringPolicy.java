package features.encounter.generation.service.search.policy;

import features.encounter.generation.service.search.model.EncounterBudgets;
import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;

/**
 * Owns branch ranking and fallback scoring for the encounter search.
 */
public final class EncounterSearchScoringPolicy {
    private static final double COMPLETE_BRANCH_BONUS = 100.0;
    private static final double VIABLE_FALLBACK_BRANCH_BONUS = 28.0;
    private static final double COMPOSITION_FIT_BRANCH_WEIGHT = 12.0;

    private EncounterSearchScoringPolicy() {
        throw new AssertionError("No instances");
    }

    public static double branchProgressScore(
            SearchState current,
            SearchState next,
            EncounterBudgets budgets,
            RelaxationProfile relaxation) {
        double score = EncounterConstraintPolicy.optimisticProgressScore(current, next, budgets, relaxation);
        EncounterConstraintPolicy.ConstraintEvaluation evaluation =
                EncounterConstraintPolicy.evaluateState(next, budgets, relaxation);
        if (evaluation.isComplete()) {
            score += COMPLETE_BRANCH_BONUS;
        } else if (evaluation.isViableFallback()) {
            score += VIABLE_FALLBACK_BRANCH_BONUS;
        }
        score += EncounterConstraintPolicy.compositionFit(next, budgets) * COMPOSITION_FIT_BRANCH_WEIGHT;
        return score;
    }

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
        score += EncounterConstraintPolicy.compositionFit(state, budgets) * 24.0;
        if (EncounterConstraintPolicy.matchesCompleteBalanceProfile(state, budgets)) {
            score += 18.0;
        }
        if (EncounterConstraintPolicy.isComplete(state, budgets, relaxation)) {
            score += 80.0;
        } else if (EncounterConstraintPolicy.isViableFallback(state, budgets, relaxation)) {
            score += 24.0;
        }
        return score;
    }
}
