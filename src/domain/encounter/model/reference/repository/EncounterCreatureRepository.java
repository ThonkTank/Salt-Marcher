package src.domain.encounter.model.reference.repository;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.reference.model.EncounterCreatureCandidateCriteria;
import src.domain.encounter.model.reference.model.EncounterCreatureReference;

public interface EncounterCreatureRepository {

    Optional<EncounterCreatureReference> loadCreature(long creatureId);

    List<EncounterCandidateProfile> loadCandidates(EncounterCreatureCandidateCriteria criteria);
}
