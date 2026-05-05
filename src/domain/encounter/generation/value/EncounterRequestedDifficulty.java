package src.domain.encounter.generation.value;

public enum EncounterRequestedDifficulty {
    AUTO,
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterRequestedDifficulty defaultDifficulty() {
        return MEDIUM;
    }

    public static EncounterRequestedDifficulty autoDifficulty() {
        return AUTO;
    }

    public boolean isAuto() {
        return this == AUTO;
    }

    public EncounterDifficultyIntent resolvedIntent() {
        return switch (this) {
            case AUTO, MEDIUM -> EncounterDifficultyIntent.MEDIUM;
            case EASY -> EncounterDifficultyIntent.EASY;
            case HARD -> EncounterDifficultyIntent.HARD;
            case DEADLY -> EncounterDifficultyIntent.DEADLY;
        };
    }
}
