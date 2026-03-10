package features.encounter.model;

import java.util.Set;

public record CreatureRoleProfile(
        Long creatureId,
        EncounterWeightClass weightClass,
        EncounterFunctionRole primaryFunctionRole,
        EncounterFunctionRole secondaryFunctionRole,
        Set<CreatureCapabilityTag> capabilityTags,
        double survivabilityActions,
        double actionUnitsPerRound,
        double offensePressure,
        double expectedTurnShare,
        double gmComplexityLoad,
        Set<String> fitFlags
) {}
