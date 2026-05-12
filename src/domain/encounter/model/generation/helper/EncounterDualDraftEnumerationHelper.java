package src.domain.encounter.model.generation.helper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterProfileCopies;

final class EncounterDualDraftEnumerationHelper {

    private static final int MAX_FIRST_DUAL_COPIES = 3;
    private static final int MAX_SECOND_DUAL_COPIES = 4;

    private EncounterDualDraftEnumerationHelper() {
    }

    static void append(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool
    ) {
        for (int index = 0; index < pool.size(); index++) {
            appendForFirstProfile(drafts, profiles, request, baseCounts, pool, index);
        }
    }

    private static void appendForFirstProfile(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            List<EncounterCandidateProfile> pool,
            int firstIndex
    ) {
        EncounterCandidateProfile first = pool.get(firstIndex);
        for (int index = firstIndex + 1; index < pool.size(); index++) {
            appendProfileCounts(drafts, profiles, request, baseCounts, first, pool.get(index));
        }
    }

    private static void appendProfileCounts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> baseCounts,
            EncounterCandidateProfile first,
            EncounterCandidateProfile second
    ) {
        int firstLimit = Math.min(MAX_FIRST_DUAL_COPIES, EncounterProfileCopies.maxAdditionalCopies(first));
        int secondLimit = Math.min(MAX_SECOND_DUAL_COPIES, EncounterProfileCopies.maxAdditionalCopies(second));
        for (int firstCount = 1; firstCount <= firstLimit; firstCount++) {
            appendSecondProfileCounts(
                    drafts,
                    profiles,
                    request,
                    baseCounts,
                    new DualProfileCountRequest(first, second, firstCount, secondLimit));
        }
    }

    private static void appendSecondProfileCounts(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest buildRequest,
            Map<Long, Integer> baseCounts,
            DualProfileCountRequest dualRequest
    ) {
        for (int secondCount = 1; secondCount <= dualRequest.secondLimit(); secondCount++) {
            Map<Long, Integer> dual = new LinkedHashMap<>(baseCounts);
            dual.merge(dualRequest.first().id(), dualRequest.firstCount(), Integer::sum);
            dual.merge(dualRequest.second().id(), secondCount, Integer::sum);
            EncounterDraftCollectionHelper.add(drafts, profiles, buildRequest, dual);
        }
    }

    private record DualProfileCountRequest(
            EncounterCandidateProfile first,
            EncounterCandidateProfile second,
            int firstCount,
            int secondLimit
    ) {
    }
}
