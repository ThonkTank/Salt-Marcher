package features.encounter.domain.generation;

public enum EncounterDifficultyIntent {
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyIntent defaultIntent() {
        return MEDIUM;
    }
}
