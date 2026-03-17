package features.world.dungeonmap.domain.model;

public record DungeonRuntimeState(
        DungeonLayout layout,
        DungeonRuntimeLocation activeLocation
) {
}
