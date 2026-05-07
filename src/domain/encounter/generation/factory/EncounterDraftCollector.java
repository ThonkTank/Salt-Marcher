package src.domain.encounter.generation.factory;

import java.util.Map;
import src.domain.encounter.generation.value.EncounterCandidateProfile;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftBuildRequest;
import src.domain.encounter.generation.value.EncounterDraftComposition;
import src.domain.encounter.generation.value.EncounterDraftKey;

final class EncounterDraftCollector {

    private EncounterDraftCollector() {
    }

    static void add(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request,
            Map<Long, Integer> counts
    ) {
        EncounterDraftComposition composition = EncounterDraftComposition.from(counts, profiles);
        for (EncounterDraft draft : EncounterDraftCreator.create(composition, request)) {
            drafts.put(EncounterDraftKey.normalized(draft.entries()), draft);
        }
    }
}
