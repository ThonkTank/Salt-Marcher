package src.domain.encounter.model.generation;

public record EncounterDifficultyThresholds(
        int easy,
        int medium,
        int hard,
        int deadly
) {
}
