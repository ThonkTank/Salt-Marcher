package features.world.dungeonmap.ui.editor.state;

public enum DungeonPaintMode {
    BRUSH("Pinsel"),
    SELECTION("Auswahl");

    private final String label;

    DungeonPaintMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
