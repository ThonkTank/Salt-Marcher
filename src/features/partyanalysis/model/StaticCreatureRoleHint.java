package features.partyanalysis.model;

import features.creatures.model.CreatureCapabilityTag;
import features.creatures.model.EncounterFunctionRole;

import java.util.Set;

/**
 * Static encounter-role hints derived from creature analysis and reusable by
 * other features without depending on encounter generation types.
 */
public record StaticCreatureRoleHint(
        EncounterFunctionRole primaryFunctionRole,
        Set<CreatureCapabilityTag> capabilityTags,
        int complexFeatureCount,
        double baseActionUnitsPerRound,
        double legendaryActionUnits
) {
    public StaticCreatureRoleHint {
        capabilityTags = capabilityTags == null ? Set.of() : Set.copyOf(capabilityTags);
    }
}
