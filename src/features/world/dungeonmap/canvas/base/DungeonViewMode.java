package features.world.dungeonmap.canvas.base;

public enum DungeonViewMode {
    GRID("Grid"),
    GRAPH("Graph");

    private final String label;

    DungeonViewMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
