package features.encounter.domain.generation;

public enum EncounterRequestedDifficulty {
    AUTO,
    EASY,
    MEDIUM,
    HARD,
    DEADLY;

    public static EncounterRequestedDifficulty autoDifficulty() {
        return AUTO;
    }

    public boolean isAuto() {
        return this == AUTO;
    }

    public int publishedDifficultyLevel() {
        return switch (this) {
            case EASY -> 1;
            case HARD -> 3;
            case DEADLY -> 4;
            case AUTO, MEDIUM -> 2;
        };
    }

    public static EncounterRequestedDifficulty fromPublishedDifficulty(boolean auto, int difficultyLevel) {
        if (auto) {
            return AUTO;
        }
        return switch (difficultyLevel) {
            case 1 -> EASY;
            case 3 -> HARD;
            case 4 -> DEADLY;
            default -> MEDIUM;
        };
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
