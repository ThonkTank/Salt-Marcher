package ui.components;

import javafx.scene.control.Label;
import javafx.scene.layout.Region;
import ui.components.difficulty.DifficultyStyles;
import ui.components.layout.LayoutComponents;

/**
 * Compatibility seam for the legacy mixed helper entrypoint.
 * New shared layout and difficulty helpers belong in their dedicated families.
 */
@SuppressWarnings("unused")
public final class ThemeColors {

    private ThemeColors() {
        throw new AssertionError("No instances");
    }

    public static Region controlSeparator() {
        return LayoutComponents.controlSeparator();
    }

    public static void applyDifficultyStyle(Label label, String difficulty) {
        DifficultyStyles.applyDifficultyStyle(label, difficulty);
    }
}
