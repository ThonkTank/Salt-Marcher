package src.domain.encounter.model.reference.port;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterCandidateProfile;
import src.domain.encounter.model.reference.EncounterCreatureReference;

public interface ApplicationEncounterCreatureCatalogPort {

    Optional<EncounterCreatureReference> loadCreature();

    List<EncounterCandidateProfile> loadCandidates();
}
