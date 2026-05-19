package src.domain.encounter.model.generation.helper;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;

public final class EncounterSearchPoolHelper {

    private static final int FIT_POOL_LIMIT = 24;
    private static final int LOW_XP_POOL_LIMIT = 16;

    private EncounterSearchPoolHelper() {
    }

    public static List<EncounterCandidateProfile> build(
            List<EncounterCandidateProfile> unlockedProfiles,
            EncounterDifficultyThresholds thresholds,
            EncounterDifficultyIntent targetDifficulty
    ) {
        int targetXp = EncounterDifficultyTargetHelper.targetAdjustedXp(targetDifficulty, thresholds);
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
                .sorted(Comparator.comparingInt(profile -> componentDistance(profile, targetXp)))
                .limit(FIT_POOL_LIMIT)
                .toList();
    }

    private static int componentDistance(EncounterCandidateProfile profile, int targetXp) {
        int half = Math.max(1, targetXp / 2);
        int third = Math.max(1, targetXp / 3);
        return Math.min(
                Math.abs(profile.xp() - targetXp),
                Math.min(
                        Math.abs(profile.xp() - half),
                        Math.abs(profile.xp() - third)));
    }

    private static List<EncounterCandidateProfile> lowestXp(List<EncounterCandidateProfile> profiles) {
        return profiles.stream()
                .sorted(Comparator.comparingInt(EncounterCandidateProfile::xp)
                        .thenComparing(profile -> profile.name(), String.CASE_INSENSITIVE_ORDER))
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
