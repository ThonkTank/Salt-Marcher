package features.encounter.builder.application.ports;

import features.creatures.model.Creature;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.StaticCreatureRoleHint;

import java.util.Map;
import java.util.Set;

public interface PartyAnalysisProvider {

    enum CacheReadiness {
        READY,
        NOT_READY,
        STORAGE_ERROR
    }

    record GenerationSnapshot(
            CacheReadiness readiness,
            Long runId,
            int partyCompositionVersion,
            String partyCompositionHash,
            Map<Long, CreatureRoleProfile> roleProfilesByCreatureId
    ) {
        public GenerationSnapshot {
            roleProfilesByCreatureId = roleProfilesByCreatureId == null ? Map.of() : Map.copyOf(roleProfilesByCreatureId);
        }
    }

    CreatureRoleProfile classifyRoleProfileForActiveParty(Creature creature);

    GenerationSnapshot loadGenerationSnapshot(Set<Long> creatureIds);

    Map<Long, StaticCreatureRoleHint> loadStaticRoleHints(Set<Long> creatureIds);

    CreatureRoleProfile fallbackRoleProfile(Creature creature, EncounterPartyBenchmarks partyBenchmarks);

    CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks partyBenchmarks,
            StaticCreatureRoleHint staticRoleHint
    );
}
