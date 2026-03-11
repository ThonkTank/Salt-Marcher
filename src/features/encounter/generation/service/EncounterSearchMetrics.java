package features.encounter.generation.service;

import features.creatures.model.CreatureCapabilityTag;
import features.creatures.model.EncounterFunctionRole;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.encounter.generation.service.search.model.SearchHeuristics;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.rules.EncounterMobSlotRules;
import features.partyanalysis.model.EncounterWeightClass;

import java.util.Set;

/**
 * Shared encounter-search formulas used across state accumulation and constraint evaluation.
 */
public final class EncounterSearchMetrics {
    private EncounterSearchMetrics() {
        throw new AssertionError("No instances");
    }

    public static SearchState.Addition additionFor(
            CandidateEntry entry,
            int count,
            int selectionWeight,
            SearchHeuristics heuristics) {
        return new SearchState.Addition(
                entry,
                count,
                entry.creature().XP * count,
                enemyActionContribution(entry, count, heuristics),
                EncounterMobSlotRules.mobSlotCount(count),
                encounterComplexActionContribution(entry, count),
                effectiveSurvivabilityActions(entry, count),
                hasHealingCapability(entry),
                Math.max(1, selectionWeight));
    }

    public static double estimatedRounds(
            SearchState state,
            double partyActionsPerRound,
            SearchHeuristics heuristics) {
        return state.estimatedRounds(
                partyActionsPerRound,
                supportRoundsMultiplier(state.usedPrimaryRoles(), state.hasHealingCapability(), heuristics));
    }

    public static double enemyActionContribution(CandidateEntry entry, int count, SearchHeuristics heuristics) {
        double baseUnits = Math.max(0.25, entry.profile().actionUnitsPerRound());
        if (entry.weightClass() == EncounterWeightClass.MINION) {
            return count * Math.max(0.25, baseUnits * heuristics.minionActionUnitMultiplier());
        }
        return count * baseUnits;
    }

    public static int encounterComplexActionContribution(CandidateEntry entry, int count) {
        return Math.max(0, entry.profile().complexActionCount()) * Math.max(0, count);
    }

    public static double supportRoundsMultiplier(
            Set<EncounterFunctionRole> primaryRoles,
            boolean hasHealingCapability,
            SearchHeuristics heuristics) {
        double multiplier = 1.0;
        if (primaryRoles.contains(EncounterFunctionRole.LEADER)) {
            multiplier += heuristics.leaderRoundsBonus();
        }
        if (primaryRoles.contains(EncounterFunctionRole.SUPPORT)) {
            multiplier += heuristics.supportRoundsBonus();
        }
        if (primaryRoles.contains(EncounterFunctionRole.CONTROLLER)) {
            multiplier += heuristics.controllerRoundsBonus();
        }
        if (hasHealingCapability) {
            multiplier += heuristics.healingRoundsBonus();
        }
        return multiplier;
    }

    public static boolean hasHealingCapability(CandidateEntry entry) {
        return entry.profile().capabilityTags().contains(CreatureCapabilityTag.HEALER);
    }

    private static double effectiveSurvivabilityActions(CandidateEntry entry, int count) {
        if (entry == null || count <= 0) {
            return 0.0;
        }
        double base = Math.max(0.25, entry.profile().survivabilityActions());
        double total = 0.0;
        double additionalWeight = additionalCreatureWeight(entry.weightClass());
        for (int i = 0; i < count; i++) {
            total += base * Math.pow(additionalWeight, i);
        }
        return total;
    }

    private static double additionalCreatureWeight(EncounterWeightClass weightClass) {
        return switch (weightClass) {
            case MINION -> 0.52;
            case REGULAR -> 0.74;
            case BOSS -> 0.90;
        };
    }
}
