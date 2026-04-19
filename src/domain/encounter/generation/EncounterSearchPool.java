package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterSearchPool {

    private static final int FIT_POOL_LIMIT = 24;
    private static final int LOW_XP_POOL_LIMIT = 16;

    private EncounterSearchPool() {
    }

    static List<EncounterCandidateProfile> build(
            List<EncounterCandidateProfile> unlockedProfiles,
            EncounterDifficultyMath.Thresholds thresholds,
            EncounterDifficultyBand targetDifficulty
    ) {
        int targetXp = EncounterDifficultyTargets.targetAdjustedXp(targetDifficulty, thresholds);
        Map<Long, EncounterCandidateProfile> merged = new LinkedHashMap<>();
        merge(merged, closestFits(unlockedProfiles, targetXp));
        merge(merged, lowestXp(unlockedProfiles));
        return List.copyOf(merged.values());
    }

    private static List<EncounterCandidateProfile> closestFits(
            List<EncounterCandidateProfile> profiles,
            int targetXp
    ) {
        return profiles.stream()
                .sorted(Comparator.comparingInt(profile -> profile.componentDistance(targetXp)))
                .limit(FIT_POOL_LIMIT)
                .toList();
    }

    private static List<EncounterCandidateProfile> lowestXp(List<EncounterCandidateProfile> profiles) {
        return profiles.stream()
                .sorted(Comparator.comparingInt(EncounterCandidateProfile::xp)
                        .thenComparing(EncounterCandidateProfile::name, String.CASE_INSENSITIVE_ORDER))
                .limit(LOW_XP_POOL_LIMIT)
                .toList();
    }

    private static void merge(
            Map<Long, EncounterCandidateProfile> merged,
            List<EncounterCandidateProfile> profiles
    ) {
        for (EncounterCandidateProfile profile : profiles) {
            merged.put(profile.id(), profile);
        }
    }
}
