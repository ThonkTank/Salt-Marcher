package src.domain.encounter.generation.value;

public record EncounterDraftXpProfile(
        int adjustedXp,
        int targetAdjustedXp,
        double multiplier
) {
}
