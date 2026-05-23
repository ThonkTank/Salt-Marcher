package src.domain.encounter.model.generation.helper;

import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;

final class EncounterDiversityDraftEnumerationHelper {

    private EncounterDiversityDraftEnumerationHelper() {
    }

    static void append(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        new EncounterDraftGenerationModel(
                request.targetDifficulty(),
                request.thresholds(),
                request.partySize(),
                request.tuning(),
                request.lockedProfiles(),
                request.lockedQuantities(),
                request.pool()).appendDiversityDrafts(drafts, profiles, request, baseCounts, pool);
    }
}
