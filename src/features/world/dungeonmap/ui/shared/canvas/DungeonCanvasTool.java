package features.world.dungeonmap.ui.shared.canvas;

import javafx.scene.Cursor;

public enum DungeonCanvasTool {
    SELECT(false, false, false, Cursor.DEFAULT),
    PAINT(true, true, false, Cursor.CROSSHAIR),
    ERASE(true, false, false, Cursor.CROSSHAIR),
    WALL(false, false, true, Cursor.HAND),
    AREA_ASSIGN(false, false, false, Cursor.DEFAULT),
    FEATURE(true, true, false, Cursor.CROSSHAIR),
    PASSAGE(false, false, true, Cursor.HAND),
    ENDPOINT(false, false, false, Cursor.HAND),
    LINK(false, false, false, Cursor.HAND);

    private final boolean brushTool;
    private final boolean fillsSquares;
    private final boolean edgeHoverEnabled;
    private final Cursor cursor;

    DungeonCanvasTool(boolean brushTool, boolean fillsSquares, boolean edgeHoverEnabled, Cursor cursor) {
        this.brushTool = brushTool;
        this.fillsSquares = fillsSquares;
        this.edgeHoverEnabled = edgeHoverEnabled;
        this.cursor = cursor;
    }

    public boolean isBrushTool() {
        return brushTool;
    }

    public boolean fillsSquares() {
        return fillsSquares;
    }

    public boolean edgeHoverEnabled() {
        return edgeHoverEnabled;
    }

    public Cursor cursor() {
        return cursor;
    }
}
