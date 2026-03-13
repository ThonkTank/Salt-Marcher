package features.world.dungeonmap.model.domain;

public record DungeonFeatureTile(
        long featureId,
        long squareId,
        int x,
        int y
) {
}
