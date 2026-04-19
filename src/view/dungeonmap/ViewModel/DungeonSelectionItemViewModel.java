package src.view.dungeonshared.ViewModel;

public record DungeonSelectionItemViewModel(
        String ownerKind,
        long ownerId,
        String partKind,
        String label
) {
}
