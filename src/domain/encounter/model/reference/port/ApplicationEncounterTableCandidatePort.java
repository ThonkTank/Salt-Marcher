package src.domain.encounter.model.reference.port;

import java.util.List;
import src.domain.encounter.model.generation.EncounterCandidateProfile;

public interface ApplicationEncounterTableCandidatePort {

    List<EncounterCandidateProfile> loadCandidates();
}
