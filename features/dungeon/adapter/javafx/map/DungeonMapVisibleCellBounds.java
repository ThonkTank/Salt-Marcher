package features.dungeon.adapter.javafx.map;

/** Integer Dungeon cells intersecting the current JavaFX canvas viewport. */
public record DungeonMapVisibleCellBounds(
        int minimumQ,
        int minimumR,
        int maximumQ,
        int maximumR
) {
    public DungeonMapVisibleCellBounds {
        if (maximumQ < minimumQ || maximumR < minimumR) {
            throw new IllegalArgumentException("visible cell bounds must be ordered");
        }
    }
}
