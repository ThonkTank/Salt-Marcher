package src.domain.encounter.generation.value;

public record EncounterDraftMetrics(
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double multiplier,
        int score,
        int targetAdjustedXp
) {
}
