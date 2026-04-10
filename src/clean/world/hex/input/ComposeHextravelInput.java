package clean.world.hex.input;

import clean.shell.input.ComposeShellInput;
import clean.world.mapcatalog.input.LoadMapsInput;

public record ComposeHextravelInput(
        LoadMapsInput.MapSummary map
) {

    public record HextravelInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
