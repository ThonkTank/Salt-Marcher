package features.world.api.state;

@SuppressWarnings("unused")
public final class ApiState {

    private final features.world.hexmap.input.ComposeInput.ComposedHexmapInput hexmap;
    private final features.world.dungeon.DungeonObject dungeonObject;

    public ApiState(ui.shell.DetailsNavigator detailsNavigator) {
        ui.shell.DetailsNavigator resolvedDetailsNavigator =
                java.util.Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.hexmap = new features.world.hexmap.HexmapObject().compose(
                new features.world.hexmap.input.ComposeInput(resolvedDetailsNavigator));
        this.dungeonObject = new features.world.dungeon.DungeonObject(
                new features.world.dungeon.input.ComposeDungeonInput(
                        resolvedDetailsNavigator,
                        hexmap.travelSurface()));
    }

    public features.world.api.input.TravelSurfaceInput travelSurface() {
        return hexmap.travelSurface();
    }

    public features.world.api.input.ViewsInput worldViews() {
        var dungeonViews = dungeonObject.views(new features.world.dungeon.input.ViewsInput(null, null));
        return new features.world.api.input.ViewsInput(
                hexmap.overworldView(),
                hexmap.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeonViews.dungeonEditorView());
    }
}
