package src.domain.encounter.published;

public enum EncounterDifficultyBand {
    AUTO,
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterDifficultyBand defaultBand() {
        return MEDIUM;
    }

    public static EncounterDifficultyBand autoBand() {
        return AUTO;
    }

    public boolean isAuto() {
        return this == AUTO;
    }
}
