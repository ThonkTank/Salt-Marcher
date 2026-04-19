package src.view.dungeonmap.api;

public record DungeonSelectionItemViewModel(
        String ownerKind,
        long ownerId,
        String partKind,
        String label
) {
}
