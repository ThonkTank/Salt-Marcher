package clean.world;

import clean.shell.input.ComposeShellInput;
import clean.world.editor.EditorObject;
import clean.world.editor.input.ComposeMapeditortabInput;
import clean.world.input.ComposeWorldInput;
import clean.world.mapcatalog.MapcatalogObject;
import clean.world.mapcatalog.input.LoadMapsInput;
import clean.world.travel.TravelObject;
import clean.world.travel.input.ComposeTraveltabInput;

/**
 * Root seam for the clean world top-level surfaces.
 */
public final class WorldObject {

    private final ComposeWorldInput.WorldInput world;

    public WorldObject(ComposeWorldInput input) {
        ComposeWorldInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.world = new WorldAssembly(resolvedInput).composeWorld();
    }

    public ComposeWorldInput.WorldInput composeWorld(ComposeWorldInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return world;
    }

    private static final class WorldAssembly {

        private final ComposeWorldInput input;

        private WorldAssembly(ComposeWorldInput input) {
            this.input = input;
        }

        private ComposeWorldInput.WorldInput composeWorld() {
            LoadMapsInput loadMapsInput = new LoadMapsInput();
            LoadMapsInput.LoadedMapsInput loadedMaps =
                    new MapcatalogObject(loadMapsInput).loadMaps(loadMapsInput);

            ComposeTraveltabInput composeTraveltabInput = new ComposeTraveltabInput(
                    input.travelNavigationGraphic(),
                    loadedMaps
            );
            ComposeShellInput.SurfaceInput travelSurface =
                    new TravelObject(composeTraveltabInput).composeTraveltab(composeTraveltabInput).surface();

            ComposeMapeditortabInput composeMapeditortabInput = new ComposeMapeditortabInput(
                    input.mapEditorNavigationGraphic(),
                    loadedMaps
            );
            ComposeShellInput.SurfaceInput mapEditorSurface =
                    new EditorObject(composeMapeditortabInput)
                            .composeMapeditortab(composeMapeditortabInput)
                            .surface();

            return new ComposeWorldInput.WorldInput(travelSurface, mapEditorSurface);
        }
    }
}
