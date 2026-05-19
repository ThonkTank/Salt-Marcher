package src.domain.encounter.model.generation.model;

public record EncounterDifficultyThresholds(
        int easy,
        int medium,
        int hard,
        int deadly
) {
}
