package features.world.dungeonmap.model.projection;

public record DungeonRuntimeState(
        DungeonMapState mapState,
        Long activeSquareId,
        boolean requiresInitialPosition
) {
}
