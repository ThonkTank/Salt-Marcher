package features.world.hexmap;

import features.world.hexmap.editorsurface.EditorsurfaceObject;
import features.world.api.input.TravelSurfaceInput;
import features.world.hexmap.input.ComposeInput;
import features.world.hexmap.ui.travel.TravelObject;

import java.util.Objects;

/**
 * Canonical hexmap root seam for world-facing composition of the overworld
 * session, editor session, and shared travel surface.
 */
@SuppressWarnings("unused")
public final class HexmapObject {

    public ComposeInput.ComposedHexmapInput compose(ComposeInput input) {
        ComposeInput resolvedInput = Objects.requireNonNull(input, "input");
        TravelObject travelPane = new TravelObject();
        TravelSurfaceInput travelSurface = new TravelSurfaceInput(
                travelPane,
                travelPane::showOverworldTravel,
                travelPane::showDungeonTravel);
        return new ComposeInput.ComposedHexmapInput(
                travelSurface,
                new features.world.hexmap.ui.overworld.surface.SurfaceObject(travelSurface),
                new EditorsurfaceObject(new features.world.hexmap.editorsurface.input.ComposeInput(
                        resolvedInput.detailsNavigator())));
    }
}
