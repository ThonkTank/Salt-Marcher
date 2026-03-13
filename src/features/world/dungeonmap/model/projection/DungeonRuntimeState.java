package features.world.dungeonmap.model.projection;

public record DungeonRuntimeState(
        DungeonMapState mapState,
        Long activeEndpointId,
        Long activeSquareId,
        boolean requiresInitialPosition
) {
}
