package src.domain.encounter.generation.value;

import src.domain.encounter.generation.policy.EncounterDifficultyMath;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public record EncounterDraftBuildRequest(
        EncounterDifficultyIntent targetDifficulty,
        EncounterDifficultyMath.Thresholds thresholds,
        int partySize,
        EncounterTuningIntent tuning,
        Collection<EncounterCandidateProfile> lockedProfiles,
        Map<Long, Integer> lockedQuantities,
        List<EncounterCandidateProfile> pool
) {
    public EncounterDraftBuildRequest {
        tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
    }
}
