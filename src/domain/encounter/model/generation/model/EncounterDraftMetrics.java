package src.domain.encounter.model.generation.model;

public record EncounterDraftMetrics(
        int creatureCount,
        int totalBaseXp,
        int adjustedXp,
        double multiplier,
        int score,
        int targetAdjustedXp
) {
}
