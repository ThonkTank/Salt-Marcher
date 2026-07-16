package features.encounter.domain.generation;

public record EncounterDifficultyThresholds(
        int easy,
        int medium,
        int hard,
        int deadly
) {
}
