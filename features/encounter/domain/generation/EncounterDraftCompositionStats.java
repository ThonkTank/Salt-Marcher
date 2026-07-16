package features.encounter.domain.generation;

public record EncounterDraftCompositionStats(
        int totalBaseXp,
        int creatureCount,
        int bossCount
) {
}
