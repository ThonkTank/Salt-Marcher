package features.world.api.state;

public final class ApiState {

    private final features.world.api.input.TravelSurfaceInput travelSurface;
    private final features.world.hexmap.HexmapObject hexMapObject;
    private final features.world.dungeon.bootstrap.BootstrapObject dungeonBootstrap;

    public ApiState(ui.shell.DetailsNavigator detailsNavigator) {
        ui.shell.DetailsNavigator resolvedDetailsNavigator =
                java.util.Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = features.world.hexmap.HexmapObject.createTravelSurface();
        this.hexMapObject = new features.world.hexmap.HexmapObject(resolvedDetailsNavigator, travelSurface);
        this.dungeonBootstrap = new features.world.dungeon.bootstrap.BootstrapObject(
                new features.world.dungeon.bootstrap.state.BootstrapState(
                        resolvedDetailsNavigator,
                        travelSurface));
    }

    public features.world.api.input.TravelSurfaceInput travelSurface() {
        return travelSurface;
    }

    public features.world.api.input.ViewsInput worldViews() {
        var hexMapViews = hexMapObject.views();
        var dungeonViews = dungeonBootstrap.bootstrapViews(null);
        return new features.world.api.input.ViewsInput(
                hexMapViews.overworldView(),
                hexMapViews.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeonViews.dungeonEditorView());
    }
}
