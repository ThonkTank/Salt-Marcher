package src.domain.encounter.reference.port;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.reference.value.EncounterCreatureCandidateCriteria;
import src.domain.encounter.reference.value.EncounterCreatureReference;

public interface EncounterCreatureLookup {

    Optional<EncounterCreatureReference> loadCreature(long creatureId);

    List<EncounterCandidateProfile> loadCandidates(EncounterCreatureCandidateCriteria criteria);
}
