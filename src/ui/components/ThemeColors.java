package ui.components;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;

import java.util.List;
import java.util.Locale;

/**
 * Static utility class combining two concerns:
 * <ol>
 *   <li><b>Canvas Color constants</b> ({@code BG_ELEVATED}, {@code TEXT_PRIMARY}, {@code EASY}…
 *       {@code DEADLY}) — used exclusively by {@link DifficultyMeter} for JavaFX Canvas drawing.
 *       These MUST stay in sync with the corresponding CSS variables in
 *       {@code resources/salt-marcher.css}. Each constant has an inline comment cross-referencing
 *       its CSS variable name.</li>
 *   <li><b>CSS style helpers</b> ({@link #controlSeparator()}, {@link #applyDifficultyStyle}) —
 *       shared helpers that create styled nodes or mutate label style classes.</li>
 * </ol>
 * Prefer CSS style classes over these constants wherever possible — Canvas drawing is the only
 * context where Java {@link javafx.scene.paint.Color} objects are required.
 */
public final class ThemeColors {
    private ThemeColors() {
        throw new AssertionError("No instances");
    }

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
