package clean.world.dungeon.input;

import clean.shell.input.ComposeShellInput;
import clean.world.mapcatalog.input.LoadMapsInput;

public record ComposeDungeontravelInput(
        LoadMapsInput.MapSummary map
) {

    public record DungeontravelInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
