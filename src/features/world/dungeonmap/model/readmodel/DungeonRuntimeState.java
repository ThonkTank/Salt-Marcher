package features.world.dungeonmap.model.readmodel;

public record DungeonRuntimeState(
        DungeonMapState mapState,
        Long activeEndpointId,
        Long activeSquareId,
        boolean requiresInitialPosition
) {
}
