package features.world.dungeonmap.ui.shared;

public enum DungeonViewMode {
    GRID("Raster"),
    GRAPH("Graph");

    private final String label;

    DungeonViewMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
