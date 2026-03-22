package features.world.hexmap.api;

import features.world.api.WorldTravelSurface;
import features.world.hexmap.ui.editor.MapEditorView;
import features.world.hexmap.ui.overworld.OverworldView;
import features.world.hexmap.ui.travel.TravelPane;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class HexMapModule {

    private final OverworldView overworldView;
    private final AppView mapEditorView;

    public static WorldTravelSurface createTravelSurface() {
        return new TravelPane();
    }

    public HexMapModule(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        Objects.requireNonNull(travelSurface, "travelSurface");
        this.overworldView = new OverworldView(travelSurface);
        this.mapEditorView = new MapEditorView(detailsNavigator);
    }

    public AppView overworldView() {
        return overworldView;
    }

    public AppView mapEditorView() {
        return mapEditorView;
    }
}
