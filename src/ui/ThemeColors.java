package ui;

import javafx.scene.paint.Color;

/**
 * Java Color constants for programmatic use (Canvas drawing, dynamic inline styles).
 * These MUST stay in sync with the CSS variables in resources/salt-marcher.css.
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
    public static final Color DEADLY = Color.web("#c60000");          // -sm-deadly

    // Dynamic role badge border color (CreatureCard inline style)
    public static Color colorForRole(String roleName) {
        if (roleName == null) return TEXT_SECONDARY;
        return switch (roleName) {
            case "BRUTE"      -> Color.web("#c62828");
            case "ARTILLERY"  -> Color.web("#f9a825");
            case "CONTROLLER" -> Color.web("#7b1fa2");
            case "SKIRMISHER" -> Color.web("#2e7d32");
            case "TANK"       -> Color.web("#1565c0");
            case "LEADER"     -> Color.web("#ff8f00");
            default           -> TEXT_SECONDARY;
        };
    }
}
