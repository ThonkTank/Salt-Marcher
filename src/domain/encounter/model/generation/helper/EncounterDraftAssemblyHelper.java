package src.domain.encounter.model.generation.helper;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;

public final class EncounterDraftAssemblyHelper {

    private EncounterDraftAssemblyHelper() {
    }

    public static List<EncounterDraft> createDrafts(EncounterDraftRequest request) {
        List<EncounterCandidateProfile> pool = EncounterSearchPoolHelper.build(
                request.unlockedProfiles(),
                request.thresholds(),
                request.targetDifficulty());
        return EncounterDraftEnumerationHelper.enumerate(new EncounterDraftBuildRequest(
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
            EncounterDifficultyMathHelper.Thresholds thresholds,
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
