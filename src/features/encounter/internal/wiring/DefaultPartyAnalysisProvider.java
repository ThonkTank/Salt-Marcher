package features.encounter.internal.wiring;

import features.creatures.model.Creature;
import features.encounter.builder.application.ports.PartyAnalysisProvider;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.partyanalysis.api.PartyAnalysisReadApi;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.StaticCreatureRoleHint;

import java.util.Map;
import java.util.Set;

public final class DefaultPartyAnalysisProvider implements PartyAnalysisProvider {

    @Override
    public CreatureRoleProfile classifyRoleProfileForActiveParty(Creature creature) {
        return PartyAnalysisReadApi.classifyRoleProfileForActiveParty(creature);
    }

    @Override
    public GenerationSnapshot loadGenerationSnapshot(Set<Long> creatureIds) {
        PartyAnalysisReadApi.GenerationSnapshot snapshot = PartyAnalysisReadApi.loadGenerationSnapshot(creatureIds);
        return new GenerationSnapshot(
                mapReadiness(snapshot.readiness()),
                snapshot.runId(),
                snapshot.partyCompositionVersion(),
                snapshot.partyCompositionHash(),
                snapshot.roleProfilesByCreatureId());
    }

    @Override
    public Map<Long, StaticCreatureRoleHint> loadStaticRoleHints(Set<Long> creatureIds) {
        return PartyAnalysisReadApi.loadStaticRoleHints(creatureIds);
    }

    @Override
    public CreatureRoleProfile fallbackRoleProfile(Creature creature, EncounterPartyBenchmarks partyBenchmarks) {
        return PartyAnalysisReadApi.fallbackRoleProfile(creature, partyBenchmarks);
    }

    @Override
    public CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks partyBenchmarks,
            StaticCreatureRoleHint staticRoleHint
    ) {
        return PartyAnalysisReadApi.fallbackRoleProfile(creature, partyBenchmarks, staticRoleHint);
    }

    private static CacheReadiness mapReadiness(PartyAnalysisReadApi.CacheReadiness readiness) {
        return switch (readiness) {
            case READY -> CacheReadiness.READY;
            case NOT_READY -> CacheReadiness.NOT_READY;
            case STORAGE_ERROR -> CacheReadiness.STORAGE_ERROR;
        };
    }
}
