package src.domain.encounter.api;

public enum EncounterDifficultyBand {
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyBand defaultBand() {
        return MEDIUM;
    }
}
