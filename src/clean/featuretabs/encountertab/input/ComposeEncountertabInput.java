package clean.featuretabs.encountertab.input;

import clean.creatures.input.ComposeEncounterhostInput;
import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeEncountertabInput(
        Node navigationGraphic,
        ComposeEncounterhostInput.EncounterhostInput encounterhost
) {

    public record EncountertabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
