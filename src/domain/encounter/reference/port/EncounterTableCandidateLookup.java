package src.domain.encounter.reference.port;

import java.util.List;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.reference.value.EncounterTableCandidateCriteria;

public interface EncounterTableCandidateLookup {

    List<EncounterCandidateProfile> loadCandidates(EncounterTableCandidateCriteria criteria);
}
