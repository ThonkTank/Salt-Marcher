package features.world.dungeon.bootstrap.input;

public record ViewsInput(
        ui.shell.DetailsNavigator detailsNavigator,
        features.world.api.input.TravelSurfaceInput travelSurface
) {
}
