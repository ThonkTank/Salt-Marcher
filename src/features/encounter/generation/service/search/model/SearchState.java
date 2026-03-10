package features.encounter.generation.service.search.model;

import features.creatures.model.EncounterFunctionRole;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.search.policy.EncounterConstraintPolicy;
import features.encounter.rules.EncounterMobSlotRules;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Immutable aggregate of the search state and its derived encounter metrics.
 */
public final class SearchState {
    private final SearchState previous;
    private final StateEntry lastEntry;
    private final int distinctStatBlocks;
    private final boolean hasHealingCapability;
    private final int nonNullPrimaryRoleCount;
    private final int rawXp;
    private final int totalCreatureCount;
    private final int adjustedXp;
    private final double enemyActionUnits;
    private final int enemyTurnSlots;
    private final double gmComplexityLoad;
    private final double totalSurvivabilityActions;
    private List<StateEntry> entriesView;
    private Map<Long, Integer> countsView;
    private Set<EncounterFunctionRole> usedPrimaryRolesView;

    public SearchState() {
        previous = null;
        lastEntry = null;
        distinctStatBlocks = 0;
        hasHealingCapability = false;
        nonNullPrimaryRoleCount = 0;
        rawXp = 0;
        totalCreatureCount = 0;
        adjustedXp = 0;
        enemyActionUnits = 0.0;
        enemyTurnSlots = 0;
        gmComplexityLoad = 0.0;
        totalSurvivabilityActions = 0.0;
        entriesView = List.of();
        countsView = Map.of();
        usedPrimaryRolesView = Set.of();
    }

    public SearchState add(CandidateEntry entry, int count) {
        return add(Addition.of(entry, count));
    }

    public SearchState add(Addition addition) {
        return new SearchState(this, addition);
    }

    private SearchState(SearchState previous, Addition addition) {
        this.previous = previous;
        this.lastEntry = new StateEntry(addition.entry(), addition.count());
        this.distinctStatBlocks = previous.distinctStatBlocks + 1;
        this.hasHealingCapability = previous.hasHealingCapability || addition.hasHealingCapability();
        this.nonNullPrimaryRoleCount = previous.nonNullPrimaryRoleCount + (addition.entry().primaryRole() != null ? 1 : 0);
        this.rawXp = previous.rawXp + addition.rawXpDelta();
        this.totalCreatureCount = previous.totalCreatureCount + addition.count();
        this.adjustedXp = EncounterScoring.applyMultiplier(rawXp, totalCreatureCount);
        this.enemyActionUnits = previous.enemyActionUnits + addition.enemyActionUnitsDelta();
        this.enemyTurnSlots = previous.enemyTurnSlots + addition.enemyTurnSlotsDelta();
        this.gmComplexityLoad = previous.gmComplexityLoad + addition.gmComplexityDelta();
        this.totalSurvivabilityActions = previous.totalSurvivabilityActions + addition.survivabilityActionsDelta();
    }

    public List<StateEntry> entries() {
        if (entriesView == null) {
            List<StateEntry> materialized = new ArrayList<>(distinctStatBlocks);
            collectEntries(materialized);
            entriesView = List.copyOf(materialized);
        }
        return entriesView;
    }

    public Map<Long, Integer> counts() {
        if (countsView == null) {
            LinkedHashMap<Long, Integer> materialized = new LinkedHashMap<>();
            collectCounts(materialized);
            countsView = Map.copyOf(materialized);
        }
        return countsView;
    }

    public Set<EncounterFunctionRole> usedPrimaryRoles() {
        if (usedPrimaryRolesView == null) {
            EnumSet<EncounterFunctionRole> materialized = EnumSet.noneOf(EncounterFunctionRole.class);
            collectUsedPrimaryRoles(materialized);
            usedPrimaryRolesView = Set.copyOf(materialized);
        }
        return usedPrimaryRolesView;
    }

    public Set<EncounterFunctionRole> primaryRoles() {
        return usedPrimaryRoles();
    }

    public int rawXp() {
        return rawXp;
    }

    public int totalCreatureCount() {
        return totalCreatureCount;
    }

    public int adjustedXp() {
        return adjustedXp;
    }

    public double enemyActionUnits() {
        return enemyActionUnits;
    }

    public int enemyTurnSlots() {
        return enemyTurnSlots;
    }

    public int distinctStatBlocks() {
        return distinctStatBlocks;
    }

    public double gmComplexityLoad() {
        return gmComplexityLoad;
    }

    public double totalSurvivabilityActions() {
        return totalSurvivabilityActions;
    }

    public double estimatedRounds(double partyActionsPerRound) {
        return totalSurvivabilityActions * EncounterConstraintPolicy.supportRoundsMultiplier(usedPrimaryRoles(), hasHealingCapability)
                / Math.max(1.0, partyActionsPerRound);
    }

    public boolean hasUniquePrimaryRoles() {
        return nonNullPrimaryRoleCount == usedPrimaryRoles().size();
    }

    public boolean isEmpty() {
        return distinctStatBlocks == 0;
    }

    public boolean containsCreature(long creatureId) {
        for (SearchState cursor = this; cursor != null && cursor.lastEntry != null; cursor = cursor.previous) {
            if (cursor.lastEntry.entry().creature().Id == creatureId) {
                return true;
            }
        }
        return false;
    }

    public boolean usesPrimaryRole(EncounterFunctionRole role) {
        if (role == null) {
            return false;
        }
        for (SearchState cursor = this; cursor != null && cursor.lastEntry != null; cursor = cursor.previous) {
            if (role == cursor.lastEntry.entry().primaryRole()) {
                return true;
            }
        }
        return false;
    }

    private void collectEntries(List<StateEntry> materialized) {
        if (previous != null) {
            previous.collectEntries(materialized);
        }
        if (lastEntry != null) {
            materialized.add(lastEntry);
        }
    }

    private void collectCounts(Map<Long, Integer> materialized) {
        if (previous != null) {
            previous.collectCounts(materialized);
        }
        if (lastEntry != null) {
            materialized.put(lastEntry.entry().creature().Id, lastEntry.count());
        }
    }

    private void collectUsedPrimaryRoles(Set<EncounterFunctionRole> materialized) {
        if (previous != null) {
            previous.collectUsedPrimaryRoles(materialized);
        }
        if (lastEntry != null && lastEntry.entry().primaryRole() != null) {
            materialized.add(lastEntry.entry().primaryRole());
        }
    }

    public record Addition(
            CandidateEntry entry,
            int count,
            int rawXpDelta,
            double enemyActionUnitsDelta,
            int enemyTurnSlotsDelta,
            double gmComplexityDelta,
            double survivabilityActionsDelta,
            boolean hasHealingCapability
    ) {
        public static Addition of(CandidateEntry entry, int count) {
            return new Addition(
                    entry,
                    count,
                    entry.creature().XP * count,
                    EncounterConstraintPolicy.enemyActionContribution(entry, count),
                    EncounterMobSlotRules.mobSlotCount(count),
                    EncounterConstraintPolicy.encounterComplexityContribution(entry, count),
                    entry.profile().survivabilityActions() * count,
                    EncounterConstraintPolicy.hasHealingCapability(entry));
        }
    }
}
