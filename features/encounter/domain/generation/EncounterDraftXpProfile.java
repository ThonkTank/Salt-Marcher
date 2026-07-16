package features.encounter.domain.generation;

public record EncounterDraftXpProfile(
        int adjustedXp,
        int targetAdjustedXp,
        double multiplier
) {
}
