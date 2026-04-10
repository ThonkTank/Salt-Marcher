package clean.featuretabs.mapeditortab.input;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

public record ComposeMapeditortabInput(
        Node navigationGraphic,
        java.util.List<LoadMapsInput.MapInput> maps
) {

    public record MapeditortabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
