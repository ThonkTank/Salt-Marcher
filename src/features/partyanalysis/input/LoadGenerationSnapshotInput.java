package features.partyanalysis.input;

import features.partyanalysis.model.CreatureRoleProfile;

import java.util.Map;
import java.util.Set;

@SuppressWarnings("unused")
public record LoadGenerationSnapshotInput(Set<Long> creatureIds) {

    public enum CacheReadiness {
        READY,
        NOT_READY,
        STORAGE_ERROR
    }

    public record LoadedGenerationSnapshotInput(
            CacheReadiness readiness,
            Long runId,
            int partyCompositionVersion,
            String partyCompositionHash,
            Map<Long, CreatureRoleProfile> roleProfilesByCreatureId
    ) {
        public LoadedGenerationSnapshotInput {
            roleProfilesByCreatureId = roleProfilesByCreatureId == null ? Map.of() : Map.copyOf(roleProfilesByCreatureId);
        }
    }
}
