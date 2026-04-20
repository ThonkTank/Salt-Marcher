package src.domain.encounter.generation.value;

import java.util.Map;

final class EncounterDraftCollector {

    private final Map<String, EncounterDraft> drafts;
    private final Map<Long, EncounterCandidateProfile> profiles;
    private final EncounterDraftBuildRequest request;

    EncounterDraftCollector(
            Map<String, EncounterDraft> drafts,
            Map<Long, EncounterCandidateProfile> profiles,
            EncounterDraftBuildRequest request
    ) {
        this.drafts = drafts;
        this.profiles = profiles;
        this.request = request;
    }

    void add(Map<Long, Integer> counts) {
        EncounterDraftComposition composition = EncounterDraftComposition.from(counts, profiles);
        for (EncounterDraft draft : EncounterDraftCreator.create(composition, request)) {
            drafts.put(EncounterDraftKey.normalized(draft.entries()), draft);
        }
    }
}
