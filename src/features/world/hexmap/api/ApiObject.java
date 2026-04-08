package features.world.hexmap.api;

import features.world.api.input.TravelSurfaceInput;
import features.world.hexmap.ui.editor.MapEditorView;
import features.world.hexmap.ui.overworld.surface.SurfaceObject;
import features.world.hexmap.ui.travel.TravelObject;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class ApiObject {

    private final SurfaceObject overworldView;
    private final AppView mapEditorView;

    public static TravelSurfaceInput createTravelSurface() {
        TravelObject travelPane = new TravelObject();
        return new TravelSurfaceInput(
                travelPane,
                travelPane::showOverworldTravel,
                travelPane::showDungeonTravel);
    }

    public ApiObject(DetailsNavigator detailsNavigator, TravelSurfaceInput travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(travelSurface, "travelSurface");
        this.overworldView = new SurfaceObject(travelSurface);
        this.mapEditorView = new MapEditorView(detailsNavigator);
    }

    public AppView overworldView() {
        return overworldView;
    }

    public AppView mapEditorView() {
        return mapEditorView;
    }
}
