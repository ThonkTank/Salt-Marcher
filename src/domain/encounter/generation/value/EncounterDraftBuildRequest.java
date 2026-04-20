package src.domain.encounter.generation.value;

import src.domain.encounter.published.EncounterDifficultyBand;

import java.util.Collection;
import java.util.List;
import java.util.Map;

record EncounterDraftBuildRequest(
        EncounterDifficultyBand targetDifficulty,
        EncounterDifficultyMath.Thresholds thresholds,
        int partySize,
        Collection<EncounterCandidateProfile> lockedProfiles,
        Map<Long, Integer> lockedQuantities,
        List<EncounterCandidateProfile> pool
) {
}
