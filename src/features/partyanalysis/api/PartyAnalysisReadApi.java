package features.partyanalysis.api;

import features.creatures.model.Creature;
import features.partyanalysis.application.EncounterPartyAnalysisService;
import features.partyanalysis.model.CreatureRoleProfile;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.partyanalysis.model.StaticCreatureRoleHint;

import java.util.Map;
import java.util.Set;

/**
 * Public read facade for encounter generation and runtime role classification.
 */
public final class PartyAnalysisReadApi {

    private PartyAnalysisReadApi() {
        throw new AssertionError("No instances");
    }

    public enum CacheReadiness {
        READY,
        NOT_READY,
        STORAGE_ERROR
    }

    public record GenerationSnapshot(
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

    public static CreatureRoleProfile classifyRoleProfileForActiveParty(Creature creature) {
        return EncounterPartyAnalysisService.classifyRoleProfileForActiveParty(creature);
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks partyBenchmarks
    ) {
        return EncounterPartyAnalysisService.fallbackRoleProfile(creature, partyBenchmarks);
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks partyBenchmarks,
            StaticCreatureRoleHint staticRoleHint
    ) {
        return EncounterPartyAnalysisService.fallbackRoleProfile(creature, partyBenchmarks, staticRoleHint);
    }

    public static Map<Long, CreatureRoleProfile> loadRoleProfilesForActiveParty() {
        return EncounterPartyAnalysisService.loadRoleProfilesForActiveParty();
    }

    public static GenerationSnapshot loadGenerationSnapshot() {
        return mapSnapshot(EncounterPartyAnalysisService.loadGenerationSnapshot());
    }

    public static GenerationSnapshot loadGenerationSnapshot(Set<Long> creatureIds) {
        return mapSnapshot(EncounterPartyAnalysisService.loadGenerationSnapshot(creatureIds));
    }

    public static Map<Long, StaticCreatureRoleHint> loadStaticRoleHints(Set<Long> creatureIds) {
        return EncounterPartyAnalysisService.loadStaticRoleHints(creatureIds);
    }

    private static GenerationSnapshot mapSnapshot(EncounterPartyAnalysisService.GenerationSnapshot snapshot) {
        if (snapshot == null) {
            return new GenerationSnapshot(CacheReadiness.STORAGE_ERROR, null, 0, null, Map.of());
        }
        return new GenerationSnapshot(
                mapReadiness(snapshot.readiness()),
                snapshot.runId(),
                snapshot.partyCompositionVersion(),
                snapshot.partyCompositionHash(),
                snapshot.roleProfilesByCreatureId());
    }

    private static CacheReadiness mapReadiness(EncounterPartyAnalysisService.CacheReadiness readiness) {
        return switch (readiness) {
            case READY -> CacheReadiness.READY;
            case NOT_READY -> CacheReadiness.NOT_READY;
            case STORAGE_ERROR -> CacheReadiness.STORAGE_ERROR;
        };
    }
}
