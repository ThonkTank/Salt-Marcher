package features.world.hexmap;

import features.world.api.input.TravelSurfaceInput;
import features.world.hexmap.editorsurface.EditorsurfaceObject;
import features.world.hexmap.overworldsurface.OverworldsurfaceObject;
import features.world.hexmap.travelsurface.TravelsurfaceObject;
import features.world.hexmap.travelsurface.input.ShowDungeonTravelInput;
import features.world.hexmap.travelsurface.input.ShowOverworldTravelInput;
import features.world.hexmap.input.ComposeInput;

import java.util.Objects;

/**
 * Canonical hexmap root seam for world-facing composition of the overworld
 * session, editor session, and shared travel surface.
 */
@SuppressWarnings("unused")
public final class HexmapObject {

    public ComposeInput.ComposedHexmapInput compose(ComposeInput input) {
        ComposeInput resolvedInput = Objects.requireNonNull(input, "input");
        TravelsurfaceObject travelPane = new TravelsurfaceObject();
        TravelSurfaceInput travelSurface = new TravelSurfaceInput(
                travelPane,
                () -> travelPane.showOverworldTravel(new ShowOverworldTravelInput()),
                presentation -> travelPane.showDungeonTravel(new ShowDungeonTravelInput(
                        presentation.mapName(),
                        presentation.areaLabel(),
                        presentation.cellLabel(),
                        presentation.headingLabel(),
                        presentation.statusLabel(),
                        presentation.actions().stream()
                                .map(action -> new ShowDungeonTravelInput.DungeonTravelActionInput(
                                        action.label(),
                                        action.action()))
                                .toList(),
                        presentation.centerAction())));
        return new ComposeInput.ComposedHexmapInput(
                travelSurface,
                new OverworldsurfaceObject(new features.world.hexmap.overworldsurface.input.ComposeInput(
                        travelSurface)),
                new EditorsurfaceObject(new features.world.hexmap.editorsurface.input.ComposeInput(
                        resolvedInput.detailsNavigator())));
    }
}
