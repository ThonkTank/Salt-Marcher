package features.world.dungeonmap.shell.editor;

public enum DungeonEditorTool {
    SELECT("Auswahl"),
    ROOM("Raum"),
    WALL("Wand"),
    DOOR("Tür"),
    CORRIDOR("Korridor");

    private final String label;

    DungeonEditorTool(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
