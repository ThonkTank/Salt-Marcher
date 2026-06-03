package src.domain.encounter.model.generation;

public enum EncounterDifficultyIntent {
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyIntent defaultIntent() {
        return MEDIUM;
    }
}
