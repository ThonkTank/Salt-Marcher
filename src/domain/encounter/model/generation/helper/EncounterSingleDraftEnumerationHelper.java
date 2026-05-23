package src.domain.encounter.model.generation.helper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.model.EncounterProfileCopies;

final class EncounterSingleDraftEnumerationHelper {

    private EncounterSingleDraftEnumerationHelper() {
    }

    static void append(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (EncounterCandidateProfile first : pool) {
            appendProfileCounts(drafts, profiles, request, baseCounts, first);
        }
    }

    private static void appendProfileCounts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            EncounterCandidateProfile first
    ) {
        for (int firstCount = 1; firstCount <= EncounterProfileCopies.maxAdditionalCopies(first); firstCount++) {
            Map<Long, Integer> single = new LinkedHashMap<>(baseCounts);
            single.put(first.id(), single.getOrDefault(first.id(), 0) + firstCount);
            EncounterDraftGenerationModel.fromRequest(request).addDraft(
                    drafts,
                    profiles,
                    request,
                    single);
        }
    }
}
