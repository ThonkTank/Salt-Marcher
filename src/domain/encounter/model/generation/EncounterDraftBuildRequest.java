package src.domain.encounter.model.generation;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record EncounterDraftBuildRequest(
        EncounterDifficultyIntent targetDifficulty,
        EncounterDifficultyThresholds thresholds,
        int partySize,
        EncounterTuningIntent tuning,
        Collection<EncounterCandidateProfile> lockedProfiles,
        Map<Long, Integer> lockedQuantities,
        List<EncounterCandidateProfile> pool
) {
    public EncounterDraftBuildRequest {
        tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
        lockedProfiles = copyProfiles(lockedProfiles);
        lockedQuantities = copyQuantities(lockedQuantities);
        pool = copyProfiles(pool);
    }

    @Override
    public Collection<EncounterCandidateProfile> lockedProfiles() {
        return copyProfiles(lockedProfiles);
    }

    @Override
    public Map<Long, Integer> lockedQuantities() {
        return copyQuantities(lockedQuantities);
    }

    @Override
    public List<EncounterCandidateProfile> pool() {
        return copyProfiles(pool);
    }

    private static List<EncounterCandidateProfile> copyProfiles(Collection<EncounterCandidateProfile> profiles) {
        return profiles == null ? List.of() : List.copyOf(profiles);
    }

    private static Map<Long, Integer> copyQuantities(Map<Long, Integer> quantities) {
        return quantities == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(quantities));
    }
}
