package clean.world.hex.input;

import clean.shell.input.ComposeShellInput;
import clean.world.mapcatalog.input.LoadMapsInput;

public record ComposeHexeditorInput(
        LoadMapsInput.MapSummary map
) {

    public record HexeditorInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
