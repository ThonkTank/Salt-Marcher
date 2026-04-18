package src.domain.encounter.service;

public record EncounterDraftEntry(
        EncounterCandidateProfile profile,
        int quantity
) {
}
