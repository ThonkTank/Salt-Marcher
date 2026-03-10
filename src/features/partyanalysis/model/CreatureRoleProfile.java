package features.partyanalysis.model;

import features.creatures.model.CreatureCapabilityTag;
import features.creatures.model.EncounterFunctionRole;

import java.util.Set;

public record CreatureRoleProfile(
        Long creatureId,
        EncounterWeightClass weightClass,
        EncounterFunctionRole primaryFunctionRole,
        Set<CreatureCapabilityTag> capabilityTags,
        double survivabilityActions,
        double actionUnitsPerRound,
        double offensePressure,
        int complexActionCount,
        Set<String> fitFlags
) {}
