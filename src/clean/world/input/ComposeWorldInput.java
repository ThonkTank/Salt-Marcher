package clean.world.input;

import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

public record ComposeWorldInput(
        Node travelNavigationGraphic,
        Node mapEditorNavigationGraphic
) {

    public record WorldInput(
            ComposeShellInput.SurfaceInput travelSurface,
            ComposeShellInput.SurfaceInput mapEditorSurface
    ) {
    }
}
