package src.domain.encounter.generation;

public record EncounterDraftMetrics(
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double multiplier,
        int score,
        int targetAdjustedXp
) {
}
