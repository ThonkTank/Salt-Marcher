package clean.featuretabs.traveltab.input;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import clean.shell.input.ComposeShellInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeTraveltabInput(
        Node navigationGraphic,
        java.util.List<LoadMapsInput.MapInput> maps
) {

    public record TraveltabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
