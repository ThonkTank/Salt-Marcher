package src.domain.encounter.model.reference.repository;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.reference.model.EncounterTableCandidateCriteria;

public interface EncounterTableCandidateRepository {

    List<EncounterCandidateProfile> loadCandidates(EncounterTableCandidateCriteria criteria);
}
