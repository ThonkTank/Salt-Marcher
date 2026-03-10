package features.encounter.generation.service.search.model;

import features.creatures.model.EncounterFunctionRole;
import features.encounter.generation.service.EncounterScoring;
import features.encounter.generation.service.search.policy.EncounterConstraintPolicy;
import features.encounter.rules.EncounterMobSlotRules;
import features.partyanalysis.model.EncounterWeightClass;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

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
    private final int complexActionCount;
    private final double totalSurvivabilityActions;
    private final Set<Long> usedCreatureIds;
    private final Set<EncounterFunctionRole> usedPrimaryRoles;
    private List<StateEntry> entriesView;
    private Map<Long, Integer> countsView;

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
        complexActionCount = 0;
        totalSurvivabilityActions = 0.0;
        usedCreatureIds = Set.of();
        usedPrimaryRoles = Set.of();
        entriesView = List.of();
        countsView = Map.of();
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
        this.complexActionCount = previous.complexActionCount + addition.complexActionDelta();
        this.totalSurvivabilityActions = previous.totalSurvivabilityActions + addition.survivabilityActionsDelta();
        this.usedCreatureIds = appendCreatureId(previous.usedCreatureIds, addition.entry().creature().Id);
        this.usedPrimaryRoles = appendPrimaryRole(previous.usedPrimaryRoles, addition.entry().primaryRole());
        this.entriesView = null;
        this.countsView = null;
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
        return usedPrimaryRoles;
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

    public int complexActionCount() {
        return complexActionCount;
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
        return usedCreatureIds.contains(creatureId);
    }

    public boolean usesPrimaryRole(EncounterFunctionRole role) {
        return role != null && usedPrimaryRoles.contains(role);
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

    private static Set<Long> appendCreatureId(Set<Long> existing, Long creatureId) {
        if (creatureId == null) {
            return existing;
        }
        HashSet<Long> ids = new HashSet<>(existing);
        ids.add(creatureId);
        return Set.copyOf(ids);
    }

    private static Set<EncounterFunctionRole> appendPrimaryRole(
            Set<EncounterFunctionRole> existing,
            EncounterFunctionRole role) {
        if (role == null) {
            return existing;
        }
        EnumSet<EncounterFunctionRole> roles = existing.isEmpty()
                ? EnumSet.noneOf(EncounterFunctionRole.class)
                : EnumSet.copyOf(existing);
        roles.add(role);
        return Set.copyOf(roles);
    }

    public record Addition(
            CandidateEntry entry,
            int count,
            int rawXpDelta,
            double enemyActionUnitsDelta,
            int enemyTurnSlotsDelta,
            int complexActionDelta,
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
                    EncounterConstraintPolicy.encounterComplexActionContribution(entry, count),
                    effectiveSurvivabilityActions(entry, count),
                    EncounterConstraintPolicy.hasHealingCapability(entry));
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
}
