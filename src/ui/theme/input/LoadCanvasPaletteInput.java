package ui.theme.input;

import javafx.scene.paint.Color;

@SuppressWarnings("unused")
public record LoadCanvasPaletteInput() {

    public record CanvasPaletteInput(
            Color bgElevated,
            Color textPrimary,
            Color easy,
            Color medium,
            Color hard,
            Color deadly
    ) {
    }
}
