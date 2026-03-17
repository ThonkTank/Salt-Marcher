package features.world.dungeonmap.domain.model;

public record DungeonLayoutEditResult(
        DungeonLayout layout,
        DungeonSelection focusSelection
) {
}
