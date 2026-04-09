package ui.components;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.Locale;

/**
 * Shared CSS-oriented UI helpers that are reused across feature-side control panes.
 */
@SuppressWarnings("unused")
public final class ThemeColors {
    private ThemeColors() {
        throw new AssertionError("No instances");
    }

    // ---- CSS style helpers ----

    private static final List<String> DIFFICULTY_STYLES =
            List.of("difficulty-easy", "difficulty-medium", "difficulty-hard", "difficulty-deadly", "text-muted");

    public static Region controlSeparator() {
        Region sep = new Region();
        sep.getStyleClass().add("control-separator");
        sep.setMinHeight(1);
        sep.setMaxHeight(1);
        VBox.setMargin(sep, new Insets(4, 0, 4, 0));
        return sep;
    }

    public static void applyDifficultyStyle(Label label, String difficulty) {
        label.getStyleClass().removeAll(DIFFICULTY_STYLES);
        String normalized = difficulty == null ? "" : difficulty.trim().toUpperCase(Locale.ROOT);
        String cls = switch (normalized) {
            case "EASY" -> "difficulty-easy";
            case "MEDIUM" -> "difficulty-medium";
            case "HARD" -> "difficulty-hard";
            case "DEADLY" -> "difficulty-deadly";
            default -> "text-muted";
        };
        label.getStyleClass().add(cls);
    }
}
