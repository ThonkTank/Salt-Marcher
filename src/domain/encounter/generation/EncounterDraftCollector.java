package src.domain.encounter.generation;

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
        EncounterDraftCreator.create(composition, request)
                .ifPresent(draft -> drafts.put(EncounterDraftKey.normalized(draft.entries()), draft));
    }
}
