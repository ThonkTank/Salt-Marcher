package features.encounter.generation.service.search;

import features.encounter.calibration.service.EncounterCalibrationService;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.creatures.model.Creature;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.partyanalysis.api.PartyAnalysisReadApi;
import features.partyanalysis.model.CreatureRoleProfile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Projects creatures into search candidates with fallback role profiles.
 */
public final class EncounterCandidateProjector {
    private EncounterCandidateProjector() {
        throw new AssertionError("No instances");
    }

    public static List<CandidateEntry> buildCandidateEntries(
            List<Creature> pool,
            Map<Long, CreatureRoleProfile> roleProfiles,
            EncounterPartyBenchmarks party) {
        List<CandidateEntry> entries = new ArrayList<>();
        for (Creature creature : pool) {
            CreatureRoleProfile profile = roleProfiles.getOrDefault(
                    creature.Id,
                    fallbackRoleProfile(creature, party));
            entries.add(new CandidateEntry(
                    creature,
                    profile,
                    profile.weightClass(),
                    profile.primaryFunctionRole()));
        }
        return entries;
    }

    public static CreatureRoleProfile fallbackRoleProfile(
            Creature creature,
            EncounterPartyBenchmarks party) {
        return PartyAnalysisReadApi.fallbackRoleProfile(creature, party);
    }
}
