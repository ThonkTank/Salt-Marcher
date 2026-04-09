package ui.theme;

import javafx.scene.paint.Color;
import ui.theme.input.LoadCanvasPaletteInput;

/**
 * Shared theme token seam for Java-side Canvas rendering that mirrors the CSS source of truth.
 */
@SuppressWarnings("unused")
public final class ThemeObject {

    private static final Color BG_ELEVATED = Color.web("#26282a");   // -sm-bg-elevated
    private static final Color TEXT_PRIMARY = Color.web("#ecedee");  // -sm-text-primary
    private static final Color EASY = Color.web("#00c680");          // -sm-easy
    private static final Color MEDIUM = Color.web("#ffb62a");        // -sm-medium
    private static final Color HARD = Color.web("#d56c19");          // -sm-hard
    private static final Color DEADLY = Color.web("#e53935");        // -sm-deadly

    public LoadCanvasPaletteInput.CanvasPaletteInput loadCanvasPalette(LoadCanvasPaletteInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new LoadCanvasPaletteInput.CanvasPaletteInput(
                BG_ELEVATED,
                TEXT_PRIMARY,
                EASY,
                MEDIUM,
                HARD,
                DEADLY);
    }
}
