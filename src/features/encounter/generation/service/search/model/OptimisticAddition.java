package features.encounter.generation.service.search.model;

import features.partyanalysis.model.EncounterFunctionRole;

/**
 * Best-case remaining addition used for optimistic feasibility pruning.
 */
public record OptimisticAddition(
        int count,
        int rawXp,
        double actionUnits,
        double survivabilityActions,
        EncounterFunctionRole primaryRole,
        boolean hasHealingCapability
) {}
