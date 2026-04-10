package clean.featuretabs.tablestab.input;

import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

public record ComposeTablestabInput(
        Node navigationGraphic
) {

    public record TablestabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
