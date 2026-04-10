package clean.startup.input;

import clean.navigation.input.ComposeNavigationInput;
import javafx.stage.Stage;

@SuppressWarnings("unused")
public record StartApplicationInput(
        Stage primaryStage,
        String applicationTitle,
        ComposeNavigationInput.SurfaceInput startSurface,
        ComposeNavigationInput.SurfaceInput encounterSurface,
        ComposeNavigationInput.SurfaceInput overworldSurface,
        ComposeNavigationInput.SurfaceInput mapEditorSurface,
        ComposeNavigationInput.SurfaceInput dungeonSurface,
        ComposeNavigationInput.SurfaceInput dungeonEditorSurface,
        ComposeNavigationInput.SurfaceInput tablesSurface,
        ComposeNavigationInput.SurfaceInput spellsSurface,
        String initialSurfaceId
) {
}
