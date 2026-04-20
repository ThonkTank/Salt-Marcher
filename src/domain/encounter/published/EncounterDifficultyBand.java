package src.domain.encounter.published;

public enum EncounterDifficultyBand {
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyBand defaultBand() {
        return MEDIUM;
    }
}
