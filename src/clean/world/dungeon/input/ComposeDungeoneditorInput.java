package clean.world.dungeon.input;

import clean.shell.input.ComposeShellInput;
import clean.world.mapcatalog.input.LoadMapsInput;

public record ComposeDungeoneditorInput(
        LoadMapsInput.MapSummary map
) {

    public record DungeoneditorInput(
            ComposeShellInput.SurfaceInput surface
    ) {
    }
}
