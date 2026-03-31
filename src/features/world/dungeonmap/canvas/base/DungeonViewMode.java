package features.world.dungeonmap.canvas.base;

/**
 * The editor currently has one supported projection. Additional modes should be added only when they preserve the
 * same direct-owner semantics as the active grid view.
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
