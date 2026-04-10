package clean.featuretabs.encountertab.input;

import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeEncountertabInput(
        Node navigationGraphic
) {

    public record EncountertabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
