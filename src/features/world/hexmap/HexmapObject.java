package features.world.hexmap;

import features.world.api.input.TravelSurfaceInput;
import features.world.hexmap.input.ViewsInput;
import features.world.hexmap.ui.travel.TravelObject;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class HexmapObject {

    private final features.world.hexmap.ui.overworld.surface.SurfaceObject overworldView;
    private final ui.shell.AppView mapEditorView;

    public static TravelSurfaceInput createTravelSurface() {
        TravelObject travelPane = new TravelObject();
        return new TravelSurfaceInput(
                travelPane,
                travelPane::showOverworldTravel,
                travelPane::showDungeonTravel);
    }

    public HexmapObject(DetailsNavigator detailsNavigator, TravelSurfaceInput travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(travelSurface, "travelSurface");
        this.overworldView = new features.world.hexmap.ui.overworld.surface.SurfaceObject(travelSurface);
        this.mapEditorView = new features.world.hexmap.ui.editor.surface.SurfaceObject(detailsNavigator);
    }

    public ViewsInput views() {
        return new ViewsInput(overworldView, mapEditorView);
    }
}
