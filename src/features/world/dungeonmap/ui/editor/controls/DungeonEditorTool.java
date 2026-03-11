package features.world.dungeonmap.ui.editor.controls;

public enum DungeonEditorTool {
    SELECT,
    PAINT,
    ERASE,
    AREA_ASSIGN,
    PASSAGE,
    ENDPOINT,
    LINK;

    public boolean isBrushTool() {
        return this == PAINT || this == ERASE;
    }

    public boolean paintsFilledSquares() {
        return this == PAINT;
    }

    public boolean isHandTool() {
        return this == ENDPOINT || this == LINK;
    }
}
