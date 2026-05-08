package src.domain.encounter.generation.value;

public enum EncounterDifficultyIntent {
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyIntent defaultIntent() {
        return MEDIUM;
    }
}
