package features.world.api.state;

@SuppressWarnings("unused")
public final class ApiState {

    private final features.world.hexmap.input.ComposeInput.ComposedHexmapInput hexmap;
    private final features.world.dungeonclean.input.ViewsInput.LoadedViewsInput dungeonViews;

    public ApiState(ui.shell.DetailsNavigator detailsNavigator, ui.shell.SceneRegistry sceneRegistry) {
        ui.shell.DetailsNavigator resolvedDetailsNavigator =
                java.util.Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        ui.shell.SceneRegistry resolvedSceneRegistry =
                java.util.Objects.requireNonNull(sceneRegistry, "sceneRegistry");
        this.hexmap = new features.world.hexmap.HexmapObject().compose(
                new features.world.hexmap.input.ComposeInput(resolvedDetailsNavigator));
        this.dungeonViews = new features.world.dungeonclean.DungeoncleanObject().views(
                new features.world.dungeonclean.input.ViewsInput(
                        resolvedDetailsNavigator,
                        resolvedSceneRegistry,
                        hexmap.travelSurface()));
    }

    public features.world.api.input.TravelSurfaceInput travelSurface() {
        return hexmap.travelSurface();
    }

    public features.world.api.input.ViewsInput worldViews() {
        return new features.world.api.input.ViewsInput(
                hexmap.overworldView(),
                hexmap.mapEditorView(),
                dungeonViews.dungeonView(),
                dungeonViews.dungeonEditorView());
    }
}
