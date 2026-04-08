package features.world.dungeon.transition.input;

public record PlacePreparedTransitionInput(
        long transitionId,
        long doorId,
        int levelZ
) {
}
