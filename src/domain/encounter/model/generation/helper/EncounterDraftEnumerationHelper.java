package src.domain.encounter.model.generation.helper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;

final class EncounterDraftEnumerationHelper {

    private static final int DRAFT_LIMIT = 30;

    private EncounterDraftEnumerationHelper() {
    }

    static List<EncounterDraft> enumerate(EncounterDraftBuildRequest request) {
        Map<String, EncounterDraft> drafts = new LinkedHashMap<>();
        Map<Long, Integer> baseCounts = new LinkedHashMap<>(request.lockedQuantities());
        Map<Long, EncounterCandidateProfile> profiles = profileLookup(request);
        EncounterDraftCollectionHelper.add(drafts, profiles, request, baseCounts);
        EncounterSingleDraftEnumerationHelper.append(drafts, profiles, request, baseCounts, request.pool());
        EncounterDualDraftEnumerationHelper.append(drafts, profiles, request, baseCounts, request.pool());
        EncounterDiversityDraftEnumerationHelper.append(drafts, profiles, request, baseCounts, request.pool());
        return EncounterDraftOrderingHelper.topDrafts(drafts.values(), DRAFT_LIMIT);
    }

    private static Map<Long, EncounterCandidateProfile> profileLookup(EncounterDraftBuildRequest request) {
        Map<Long, EncounterCandidateProfile> profiles = new LinkedHashMap<>();
        for (EncounterCandidateProfile locked : request.lockedProfiles()) {
            profiles.put(locked.id(), locked);
        }
        for (EncounterCandidateProfile profile : request.pool()) {
            profiles.put(profile.id(), profile);
        }
        return profiles;
    }
}
