package features.world.dungeonmap.ui.editor.toolbar;

public enum WallEditorMode {
    PAINT_WALL("Wand malen"),
    ERASE_WALL("Wand loeschen");

    private final String label;

    WallEditorMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean paintsWalls() {
        return this == PAINT_WALL;
    }

    public boolean erasesWalls() {
        return this == ERASE_WALL;
    }
}
