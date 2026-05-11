package src.domain.encounter.model.generation.helper;

import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterDraftComposition;
import src.domain.encounter.model.generation.model.EncounterDraftKey;

final class EncounterDraftCollectionHelper {

    private EncounterDraftCollectionHelper() {
    }

    static void add(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> counts
    ) {
        EncounterDraftComposition composition = EncounterDraftComposition.from(counts, profiles);
        for (EncounterDraft draft : EncounterDraftCreationHelper.create(composition, request)) {
            drafts.put(EncounterDraftKey.normalized(draft.entries()), draft);
        }
    }
}
