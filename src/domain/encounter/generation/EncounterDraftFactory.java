package src.domain.encounter.generation;

import src.domain.encounter.api.EncounterDifficultyBand;

import java.util.Collection;
import java.util.List;
import java.util.Map;

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
                request.lockedProfiles(),
                request.lockedQuantities(),
                pool));
    }

    public record EncounterDraftRequest(
            EncounterDifficultyBand targetDifficulty,
            EncounterDifficultyMath.Thresholds thresholds,
            int partySize,
            Collection<EncounterCandidateProfile> lockedProfiles,
            Map<Long, Integer> lockedQuantities,
            List<EncounterCandidateProfile> unlockedProfiles
    ) {
    }
}
