package src.domain.encounter.generation.value;


import java.util.Collection;
import java.util.List;
import java.util.Map;

record EncounterDraftBuildRequest(
        EncounterDifficultyIntent targetDifficulty,
        EncounterDifficultyMath.Thresholds thresholds,
        int partySize,
        Collection<EncounterCandidateProfile> lockedProfiles,
        Map<Long, Integer> lockedQuantities,
        List<EncounterCandidateProfile> pool
) {
}
