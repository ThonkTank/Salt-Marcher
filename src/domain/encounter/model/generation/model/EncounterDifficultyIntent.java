package src.domain.encounter.model.generation.model;

public enum EncounterDifficultyIntent {
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyIntent defaultIntent() {
        return MEDIUM;
    }
}
