package features.world.dungeonmap.model;

public record DungeonRuntimeState(
        DungeonMapState mapState,
        Long activeEndpointId
) {
}
