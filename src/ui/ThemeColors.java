package ui;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;

import java.util.List;

/**
 * Color constants for Canvas drawing + shared UI style helpers.
 * Canvas colors MUST stay in sync with the CSS variables in resources/salt-marcher.css.
 * Prefer CSS style classes over these constants wherever possible.
 */
public final class ThemeColors {
    private ThemeColors() {}

    // Canvas painting (DifficultyMeter) — no CSS equivalent for Canvas
    public static final Color BG_ELEVATED   = Color.web("#26282a");  // -sm-bg-elevated
    public static final Color TEXT_PRIMARY   = Color.web("#ecedee");  // -sm-text-primary
    public static final Color TEXT_SECONDARY = Color.web("#a4a7ab");  // -sm-text-secondary
    public static final Color EASY   = Color.web("#00c680");          // -sm-easy
    public static final Color MEDIUM = Color.web("#ffb62a");          // -sm-medium
    public static final Color HARD   = Color.web("#d56c19");          // -sm-hard
    public static final Color DEADLY = Color.web("#e53935");          // -sm-deadly

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
        String cls = switch (difficulty != null ? difficulty : "") {
            case "Easy"   -> "difficulty-easy";
            case "Medium" -> "difficulty-medium";
            case "Hard"   -> "difficulty-hard";
            case "Deadly" -> "difficulty-deadly";
            default       -> "text-muted";
        };
        label.getStyleClass().add(cls);
    }
}
