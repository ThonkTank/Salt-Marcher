package src.domain.encounter.published;

import src.domain.encounter.generation.value.EncounterRequestedDifficulty;

public final class EncounterDifficultyBand {

    public static final EncounterDifficultyBand AUTO = new EncounterDifficultyBand("AUTO");
    public static final EncounterDifficultyBand EASY = new EncounterDifficultyBand("EASY");
    public static final EncounterDifficultyBand MEDIUM = new EncounterDifficultyBand("MEDIUM");
    public static final EncounterDifficultyBand HARD = new EncounterDifficultyBand("HARD");
    public static final EncounterDifficultyBand DEADLY = new EncounterDifficultyBand("DEADLY");

    private final EncounterRequestedDifficulty difficulty;

    private EncounterDifficultyBand(String name) {
        this.difficulty = EncounterRequestedDifficulty.valueOf(name);
    }

    public static EncounterDifficultyBand defaultBand() {
        return MEDIUM;
    }

    public static EncounterDifficultyBand autoBand() {
        return AUTO;
    }

    public static EncounterDifficultyBand fromDifficulty(EncounterRequestedDifficulty difficulty) {
        EncounterRequestedDifficulty effective = difficulty == null
                ? EncounterRequestedDifficulty.defaultDifficulty()
                : difficulty;
        return valueOf(effective.name());
    }

    public EncounterRequestedDifficulty toDifficulty() {
        return difficulty;
    }

    public boolean isAuto() {
        return difficulty.isAuto();
    }

    public String name() {
        return difficulty.name();
    }

    public static EncounterDifficultyBand valueOf(String value) {
        return switch (value) {
            case "AUTO" -> AUTO;
            case "EASY" -> EASY;
            case "HARD" -> HARD;
            case "DEADLY" -> DEADLY;
            case "MEDIUM" -> MEDIUM;
            default -> throw new IllegalArgumentException("Unknown EncounterDifficultyBand: " + value);
        };
    }

    @Override
    public String toString() {
        return difficulty.name();
    }
}
