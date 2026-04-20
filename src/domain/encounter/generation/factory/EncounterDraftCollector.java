package src.domain.encounter.generation.factory;

import src.domain.encounter.generation.policy.*;
import src.domain.encounter.generation.value.*;

import java.util.Map;

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
