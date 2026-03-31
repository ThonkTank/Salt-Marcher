package features.world.dungeonmap.canvas.base;

/**
 * The clean editor currently exposes only the grid projection.
 *
 * <p>The old graph mode was intentionally removed instead of being partially adapted to the new corridor graph
 * semantics.
 */
public enum DungeonViewMode {
    GRID("Grid");

    private final String label;

    DungeonViewMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
