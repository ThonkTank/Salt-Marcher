package features.world.dungeonmap.ui.editor.controls;

public enum WallEditorMode {
    PAINT_WALL("Wand malen"),
    ERASE_WALL("Wand loeschen"),
    PLACE_PASSAGE("Durchgang setzen");

    private final String label;

    WallEditorMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean usesStrokeEditing() {
        return this != PLACE_PASSAGE;
    }

    public boolean paintsWalls() {
        return this == PAINT_WALL;
    }

    public boolean erasesWalls() {
        return this == ERASE_WALL;
    }

    public boolean placesPassages() {
        return this == PLACE_PASSAGE;
    }
}
