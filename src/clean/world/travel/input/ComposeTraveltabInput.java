package clean.world.travel.input;

import clean.shell.input.ComposeShellInput;
import clean.world.mapcatalog.input.LoadMapsInput;
import javafx.scene.Node;

public record ComposeTraveltabInput(
        Node navigationGraphic,
        LoadMapsInput.LoadedMapsInput loadedMaps
) {

    public record TraveltabInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
