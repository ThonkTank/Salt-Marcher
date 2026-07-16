package features.encounter.application;

import java.util.List;
import features.encounter.domain.generation.EncounterCandidateProfile;

@FunctionalInterface
public interface GeneratedEncounterPlanCandidateSource {

    List<EncounterCandidateProfile> loadExactXpCandidates(int xp);
}
