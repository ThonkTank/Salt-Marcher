package src.domain.encounter.generation.factory;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.generation.policy.EncounterDifficultyMath;
import src.domain.encounter.generation.policy.EncounterSearchPool;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.generation.value.EncounterDifficultyIntent;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftBuildRequest;
import src.domain.encounter.generation.value.EncounterTuningIntent;

public final class EncounterDraftFactory {

    private EncounterDraftFactory() {
    }

    public static List<EncounterDraft> createDrafts(EncounterDraftRequest request) {
        List<EncounterCandidateProfile> pool = EncounterSearchPool.build(
                request.unlockedProfiles(),
                request.thresholds(),
                request.targetDifficulty());
        return EncounterDraftEnumerator.enumerate(new EncounterDraftBuildRequest(
                request.targetDifficulty(),
                request.thresholds(),
                request.partySize(),
                request.tuning(),
                request.lockedProfiles(),
                request.lockedQuantities(),
                pool));
    }

    public record EncounterDraftRequest(
            EncounterDifficultyIntent targetDifficulty,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize,
            EncounterTuningIntent tuning,
            Collection<EncounterCandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {

        public EncounterDraftRequest {
            tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
            lockedProfiles = lockedProfiles == null ? List.of() : List.copyOf(lockedProfiles);
            lockedQuantities = lockedQuantities == null
                    ? Map.of()
                    : Collections.unmodifiableMap(new LinkedHashMap<>(lockedQuantities));
            unlockedProfiles = unlockedProfiles == null ? List.of() : List.copyOf(unlockedProfiles);
        }

        @Override
        public Collection<EncounterCandidateProfile> lockedProfiles() {
            return List.copyOf(lockedProfiles);
        }

        @Override
        public Map<Long, Integer> lockedQuantities() {
            return Collections.unmodifiableMap(new LinkedHashMap<>(lockedQuantities));
        }

        @Override
        public List<EncounterCandidateProfile> unlockedProfiles() {
            return List.copyOf(unlockedProfiles);
        }
    }
}
