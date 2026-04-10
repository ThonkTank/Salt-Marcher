package features.partyanalysis.api;

import features.creatures.model.Creature;
import features.partyanalysis.PartyanalysisObject;
import features.partyanalysis.input.ClassifyRoleProfileForActivePartyInput;
import features.partyanalysis.input.FallbackRoleProfileInput;
import features.partyanalysis.input.LoadGenerationSnapshotInput;
import features.partyanalysis.input.LoadRoleProfilesForActivePartyInput;
import features.partyanalysis.input.LoadStaticRoleHintsInput;
import features.partyanalysis.model.CreatureRoleProfile;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.partyanalysis.model.StaticCreatureRoleHint;

import java.util.Map;
import java.util.Set;

/**
 * Public read facade for encounter generation and runtime role classification.
 */
@SuppressWarnings("unused")
public final class PartyAnalysisReadApi {
    private static final PartyanalysisObject PARTY_ANALYSIS_OBJECT = new PartyanalysisObject();

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
        return PARTY_ANALYSIS_OBJECT.classifyRoleProfileForActiveParty(
                new ClassifyRoleProfileForActivePartyInput(creature)).roleProfile();
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks partyBenchmarks
    ) {
        return PARTY_ANALYSIS_OBJECT.fallbackRoleProfile(
                new FallbackRoleProfileInput(creature, partyBenchmarks, null)).roleProfile();
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks partyBenchmarks,
            StaticCreatureRoleHint staticRoleHint
    ) {
        return PARTY_ANALYSIS_OBJECT.fallbackRoleProfile(
                new FallbackRoleProfileInput(creature, partyBenchmarks, staticRoleHint)).roleProfile();
    }

    public static Map<Long, CreatureRoleProfile> loadRoleProfilesForActiveParty() {
        return PARTY_ANALYSIS_OBJECT.loadRoleProfilesForActiveParty(
                new LoadRoleProfilesForActivePartyInput()).roleProfilesByCreatureId();
    }

    public static GenerationSnapshot loadGenerationSnapshot() {
        return mapSnapshot(PARTY_ANALYSIS_OBJECT.loadGenerationSnapshot(new LoadGenerationSnapshotInput(Set.of())));
    }

    public static GenerationSnapshot loadGenerationSnapshot(Set<Long> creatureIds) {
        return mapSnapshot(PARTY_ANALYSIS_OBJECT.loadGenerationSnapshot(new LoadGenerationSnapshotInput(creatureIds)));
    }

    public static Map<Long, StaticCreatureRoleHint> loadStaticRoleHints(Set<Long> creatureIds) {
        return PARTY_ANALYSIS_OBJECT.loadStaticRoleHints(
                new LoadStaticRoleHintsInput(creatureIds)).staticRoleHintsByCreatureId();
    }

    private static GenerationSnapshot mapSnapshot(LoadGenerationSnapshotInput.LoadedGenerationSnapshotInput snapshot) {
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

    private static CacheReadiness mapReadiness(LoadGenerationSnapshotInput.CacheReadiness readiness) {
        return switch (readiness) {
            case READY -> CacheReadiness.READY;
            case NOT_READY -> CacheReadiness.NOT_READY;
            case STORAGE_ERROR -> CacheReadiness.STORAGE_ERROR;
        };
    }
}
