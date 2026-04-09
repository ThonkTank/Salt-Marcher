package features.world.api.state;

public final class ApiState {

    private final features.world.api.input.TravelSurfaceInput travelSurface;
    private final features.world.hexmap.HexmapObject hexMapObject;
    private final features.world.dungeon.DungeonObject dungeonObject;
    private final features.world.dungeonclean.DungeoncleanObject dungeoncleanObject;

    public ApiState(ui.shell.DetailsNavigator detailsNavigator) {
        ui.shell.DetailsNavigator resolvedDetailsNavigator =
                java.util.Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = features.world.hexmap.HexmapObject.createTravelSurface();
        this.hexMapObject = new features.world.hexmap.HexmapObject(resolvedDetailsNavigator, travelSurface);
        this.dungeonObject = new features.world.dungeon.DungeonObject(
                new features.world.dungeon.input.ComposeDungeonInput(
                        resolvedDetailsNavigator,
                        travelSurface));
        this.dungeoncleanObject = new features.world.dungeonclean.DungeoncleanObject();
    }

    public features.world.api.input.TravelSurfaceInput travelSurface() {
        return travelSurface;
    }

    public features.world.api.input.ViewsInput worldViews() {
        var hexMapViews = hexMapObject.views();
        var dungeonViews = dungeonObject.views(new features.world.dungeon.input.ViewsInput(null, null));
        var dungeoncleanViews = dungeoncleanObject.views(new features.world.dungeonclean.input.ViewsInput(null));
        return new features.world.api.input.ViewsInput(
                hexMapViews.overworldView(),
                hexMapViews.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeoncleanViews.dungeonCleanView());
    }
}
