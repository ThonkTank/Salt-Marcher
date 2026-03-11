package features.encounter.generation.service.search;

import features.creatures.model.Creature;
import features.encounter.generation.service.search.model.CandidateEntry;
import features.partyanalysis.model.CreatureRoleProfile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Projects already-enriched creatures into search candidates.
 */
public final class EncounterCandidateProjector {
    private EncounterCandidateProjector() {
        throw new AssertionError("No instances");
    }

    public static List<CandidateEntry> buildCandidateEntries(
            List<Creature> pool,
            Map<Long, CreatureRoleProfile> roleProfiles) {
        List<CandidateEntry> entries = new ArrayList<>();
        for (Creature creature : pool) {
            CreatureRoleProfile profile = roleProfiles.get(creature.Id);
            if (profile == null) {
                continue;
            }
            entries.add(new CandidateEntry(
                    creature,
                    profile,
                    profile.weightClass(),
                    profile.primaryFunctionRole()));
        }
        return entries;
    }
}
