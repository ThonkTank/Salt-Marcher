package features.world.dungeon.bootstrap.state;

public final class BootstrapState {

    private final ui.shell.DetailsNavigator detailsNavigator;
    private final features.world.api.input.TravelSurfaceInput travelSurface;

    public BootstrapState(
            ui.shell.DetailsNavigator detailsNavigator,
            features.world.api.input.TravelSurfaceInput travelSurface
    ) {
        this.detailsNavigator = java.util.Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = java.util.Objects.requireNonNull(travelSurface, "travelSurface");
    }

    public ui.shell.DetailsNavigator detailsNavigator() {
        return detailsNavigator;
    }

    public features.world.api.input.TravelSurfaceInput travelSurface() {
        return travelSurface;
    }
}
