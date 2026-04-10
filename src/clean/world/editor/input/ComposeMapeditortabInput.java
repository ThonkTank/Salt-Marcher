package clean.world.editor.input;

import clean.shell.input.ComposeShellInput;
import clean.world.mapcatalog.input.LoadMapsInput;
import javafx.scene.Node;

public record ComposeMapeditortabInput(
        Node navigationGraphic,
        LoadMapsInput.LoadedMapsInput loadedMaps
) {

    public record MapeditortabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
