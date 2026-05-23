package src.domain.encounter.model.generation.model;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class EncounterSearchPoolModel {

    private static final int FIT_POOL_LIMIT = 24;
    private static final int LOW_XP_POOL_LIMIT = 16;

    private EncounterSearchPoolModel() {
    }

    static List<EncounterCandidateProfile> buildSearchPool(
            List<EncounterCandidateProfile> unlockedProfiles,
            EncounterDifficultyThresholds thresholds,
            EncounterDifficultyIntent targetDifficulty
    ) {
        int targetXp = EncounterDifficultyBandModel.of(targetDifficulty, thresholds).targetAdjustedXp();
        Map<Long, EncounterCandidateProfile> merged = new LinkedHashMap<>();
        mergeProfiles(merged, closestFits(unlockedProfiles, targetXp));
        mergeProfiles(merged, lowestXp(unlockedProfiles));
        return List.copyOf(merged.values());
    }

    static List<EncounterCandidateProfile> byLowXp(List<EncounterCandidateProfile> selected) {
        List<EncounterCandidateProfile> profiles = new ArrayList<>(selected);
        profiles.sort(new CandidateLowXpComparator());
        return List.copyOf(profiles);
    }

    private static List<EncounterCandidateProfile> closestFits(
            List<EncounterCandidateProfile> profiles,
            int targetXp
    ) {
        List<EncounterCandidateProfile> sortedProfiles = new ArrayList<>(profiles == null ? List.of() : profiles);
        sortedProfiles.sort(new ClosestFitComparator(targetXp));
        return limited(sortedProfiles, FIT_POOL_LIMIT);
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
        List<EncounterCandidateProfile> sortedProfiles = new ArrayList<>(profiles == null ? List.of() : profiles);
        sortedProfiles.sort(new CandidateLowXpComparator());
        return limited(sortedProfiles, LOW_XP_POOL_LIMIT);
    }

    private static List<EncounterCandidateProfile> limited(List<EncounterCandidateProfile> profiles, int limit) {
        if (profiles.size() <= limit) {
            return List.copyOf(profiles);
        }
        return List.copyOf(profiles.subList(0, limit));
    }

    private static void mergeProfiles(
            Map<Long, EncounterCandidateProfile> merged,
            List<EncounterCandidateProfile> profiles
    ) {
        for (EncounterCandidateProfile profile : profiles) {
            merged.put(profile.id(), profile);
        }
    }

    private static final class ClosestFitComparator implements Comparator<EncounterCandidateProfile>, Serializable {
        @Serial
        private static final long serialVersionUID = 1L;

        private final int targetXp;

        private ClosestFitComparator(int targetXp) {
            this.targetXp = targetXp;
        }

        @Override
        public int compare(EncounterCandidateProfile left, EncounterCandidateProfile right) {
            return Integer.compare(componentDistance(left, targetXp), componentDistance(right, targetXp));
        }
    }

    private static final class CandidateLowXpComparator implements Comparator<EncounterCandidateProfile>, Serializable {
        @Serial
        private static final long serialVersionUID = 1L;

        @Override
        public int compare(EncounterCandidateProfile left, EncounterCandidateProfile right) {
            int xpComparison = Integer.compare(left.xp(), right.xp());
            if (xpComparison != 0) {
                return xpComparison;
            }
            return String.CASE_INSENSITIVE_ORDER.compare(left.name(), right.name());
        }
    }
}
