package src.domain.encounter.model.generation.model;

public record EncounterDraftXpProfile(
        int adjustedXp,
        int targetAdjustedXp,
        double multiplier
) {
}
