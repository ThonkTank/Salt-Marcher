package features.encounter.ui;

import features.encounter.generation.service.EncounterDifficultyBand;

import java.util.Locale;

public final class EncounterDifficultyUiText {
    private EncounterDifficultyUiText() {
        throw new AssertionError("No instances");
    }

    public static String formatBand(EncounterDifficultyBand difficultyBand) {
        if (difficultyBand == null) {
            return "";
        }
        return switch (difficultyBand) {
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case DEADLY -> "Deadly";
        };
    }

    public static String formatDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) {
            return "";
        }
        return switch (difficulty.trim().toUpperCase(Locale.ROOT)) {
            case "EASY" -> "Easy";
            case "MEDIUM" -> "Medium";
            case "HARD" -> "Hard";
            case "DEADLY" -> "Deadly";
            case "TRIVIAL" -> "Trivial";
            default -> difficulty;
        };
    }
}
