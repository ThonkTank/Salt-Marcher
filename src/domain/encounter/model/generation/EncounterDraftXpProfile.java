package src.domain.encounter.model.generation;

public record EncounterDraftXpProfile(
        int adjustedXp,
        int targetAdjustedXp,
        double multiplier
) {
}
