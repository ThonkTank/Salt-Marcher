package features.world.dungeonmap.model;

public record DungeonRuntimeState(
        DungeonLayout layout,
        DungeonRuntimeLocation activeLocation
) {
}
