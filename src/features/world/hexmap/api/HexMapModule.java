package features.world.hexmap.api;

import features.world.api.WorldTravelSurface;
import features.world.hexmap.ui.editor.MapEditorView;
import features.world.hexmap.ui.overworld.OverworldView;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class HexMapModule {

    private final OverworldView overworldView;
    private final AppView mapEditorView;

    public HexMapModule(DetailsNavigator detailsNavigator, WorldTravelSurface travelSurface) {
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");
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
