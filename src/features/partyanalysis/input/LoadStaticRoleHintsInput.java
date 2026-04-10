package features.partyanalysis.input;

import features.partyanalysis.model.StaticCreatureRoleHint;

import java.util.Map;
import java.util.Set;

@SuppressWarnings("unused")
public record LoadStaticRoleHintsInput(Set<Long> creatureIds) {

    public record LoadedStaticRoleHintsInput(
            Map<Long, StaticCreatureRoleHint> staticRoleHintsByCreatureId
    ) {
    }
}
