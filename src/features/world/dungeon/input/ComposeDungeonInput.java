package features.world.dungeon.input;

public record ComposeDungeonInput(
        ui.shell.DetailsNavigator detailsNavigator,
        features.world.api.input.TravelSurfaceInput travelSurface
) {
}
