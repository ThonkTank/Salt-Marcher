package src.domain.encounter.generation;

public record EncounterDraftEntry(
        EncounterCandidateProfile profile,
        int quantity
) {
}
