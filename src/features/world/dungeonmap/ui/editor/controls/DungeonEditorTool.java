package features.world.dungeonmap.ui.editor.controls;

import javafx.scene.Cursor;

public enum DungeonEditorTool {
    SELECT(false, false, false, false, false, false, Cursor.DEFAULT, CellClickAction.SELECT_SQUARE),
    PAINT(true, true, true, true, false, false, Cursor.CROSSHAIR, CellClickAction.SELECT_SQUARE),
    ERASE(true, false, false, true, false, false, Cursor.DISAPPEAR, CellClickAction.SELECT_SQUARE),
    AREA_ASSIGN(false, false, false, false, true, false, Cursor.DEFAULT, CellClickAction.ASSIGN_ROOM_AREA),
    FEATURE(false, false, false, false, false, false, Cursor.HAND, CellClickAction.SELECT_SQUARE),
    PASSAGE(false, false, false, false, false, true, Cursor.HAND, CellClickAction.SELECT_SQUARE),
    ENDPOINT(false, false, false, false, false, false, Cursor.HAND, CellClickAction.CREATE_OR_SELECT_ENDPOINT),
    LINK(false, false, false, false, false, false, Cursor.HAND, CellClickAction.SELECT_SQUARE);

    public enum CellClickAction {
        SELECT_SQUARE,
        ASSIGN_ROOM_AREA,
        CREATE_OR_SELECT_ENDPOINT
    }

    private final boolean brushTool;
    private final boolean fillsSquares;
    private final boolean roomSettingsVisible;
    private final boolean brushSettingsVisible;
    private final boolean areaSettingsVisible;
    private final boolean edgeHoverEnabled;
    private final Cursor cursor;
    private final CellClickAction cellClickAction;

    DungeonEditorTool(
            boolean brushTool,
            boolean fillsSquares,
            boolean roomSettingsVisible,
            boolean brushSettingsVisible,
            boolean areaSettingsVisible,
            boolean edgeHoverEnabled,
            Cursor cursor,
            CellClickAction cellClickAction
    ) {
        this.brushTool = brushTool;
        this.fillsSquares = fillsSquares;
        this.roomSettingsVisible = roomSettingsVisible;
        this.brushSettingsVisible = brushSettingsVisible;
        this.areaSettingsVisible = areaSettingsVisible;
        this.edgeHoverEnabled = edgeHoverEnabled;
        this.cursor = cursor;
        this.cellClickAction = cellClickAction;
    }

    public boolean isBrushTool() {
        return brushTool;
    }

    public boolean fillsSquares() {
        return fillsSquares;
    }

    public boolean roomSettingsVisible() {
        return roomSettingsVisible;
    }

    public boolean brushSettingsVisible() {
        return brushSettingsVisible;
    }

    public boolean areaSettingsVisible() {
        return areaSettingsVisible;
    }

    public boolean linkStatusVisible() {
        return this == LINK;
    }

    public boolean edgeHoverEnabled() {
        return edgeHoverEnabled;
    }

    public boolean autoShowsSelectedRoom() {
        return this == PAINT;
    }

    public boolean autoShowsSelectedArea() {
        return this == AREA_ASSIGN;
    }

    public boolean featureSettingsVisible() {
        return this == FEATURE;
    }

    public Cursor cursor() {
        return cursor;
    }

    public CellClickAction cellClickAction() {
        return cellClickAction;
    }
}
