package ui.components.difficulty;

import javafx.scene.control.Label;

import java.util.List;
import java.util.Locale;

/**
 * Shared difficulty label styling helper for reusable encounter severity text.
 */
@SuppressWarnings("unused")
public final class DifficultyStyles {

    private static final List<String> DIFFICULTY_STYLES =
            List.of("difficulty-easy", "difficulty-medium", "difficulty-hard", "difficulty-deadly", "text-muted");

    private DifficultyStyles() {
        throw new AssertionError("No instances");
    }

    public static void applyDifficultyStyle(Label label, String difficulty) {
        label.getStyleClass().removeAll(DIFFICULTY_STYLES);
        String normalized = difficulty == null ? "" : difficulty.trim().toUpperCase(Locale.ROOT);
        String styleClass = switch (normalized) {
            case "EASY" -> "difficulty-easy";
            case "MEDIUM" -> "difficulty-medium";
            case "HARD" -> "difficulty-hard";
            case "DEADLY" -> "difficulty-deadly";
            default -> "text-muted";
        };
        label.getStyleClass().add(styleClass);
    }
}
