package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import javafx.scene.Cursor;

public final class DungeonToolBehavior {

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
    private final boolean linkStatusVisible;
    private final boolean edgeHoverEnabled;
    private final boolean autoShowsSelectedRoom;
    private final boolean autoShowsSelectedArea;
    private final Cursor cursor;
    private final CellClickAction cellClickAction;

    private DungeonToolBehavior(
            boolean brushTool,
            boolean fillsSquares,
            boolean roomSettingsVisible,
            boolean brushSettingsVisible,
            boolean areaSettingsVisible,
            boolean linkStatusVisible,
            boolean edgeHoverEnabled,
            boolean autoShowsSelectedRoom,
            boolean autoShowsSelectedArea,
            Cursor cursor,
            CellClickAction cellClickAction
    ) {
        this.brushTool = brushTool;
        this.fillsSquares = fillsSquares;
        this.roomSettingsVisible = roomSettingsVisible;
        this.brushSettingsVisible = brushSettingsVisible;
        this.areaSettingsVisible = areaSettingsVisible;
        this.linkStatusVisible = linkStatusVisible;
        this.edgeHoverEnabled = edgeHoverEnabled;
        this.autoShowsSelectedRoom = autoShowsSelectedRoom;
        this.autoShowsSelectedArea = autoShowsSelectedArea;
        this.cursor = cursor;
        this.cellClickAction = cellClickAction;
    }

    public static DungeonToolBehavior forTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        return switch (effectiveTool) {
            case SELECT -> new DungeonToolBehavior(
                    false, false, false, false, false, false, false,
                    false, false, Cursor.DEFAULT, CellClickAction.SELECT_SQUARE);
            case PAINT -> new DungeonToolBehavior(
                    true, true, true, true, false, false, false,
                    true, false, Cursor.CROSSHAIR, CellClickAction.SELECT_SQUARE);
            case ERASE -> new DungeonToolBehavior(
                    true, false, false, true, false, false, false,
                    false, false, Cursor.DISAPPEAR, CellClickAction.SELECT_SQUARE);
            case AREA_ASSIGN -> new DungeonToolBehavior(
                    false, false, false, false, true, false, false,
                    false, true, Cursor.DEFAULT, CellClickAction.ASSIGN_ROOM_AREA);
            case PASSAGE -> new DungeonToolBehavior(
                    false, false, false, false, false, false, true,
                    false, false, Cursor.HAND, CellClickAction.SELECT_SQUARE);
            case ENDPOINT -> new DungeonToolBehavior(
                    false, false, false, false, false, false, false,
                    false, false, Cursor.HAND, CellClickAction.CREATE_OR_SELECT_ENDPOINT);
            case LINK -> new DungeonToolBehavior(
                    false, false, false, false, false, true, false,
                    false, false, Cursor.HAND, CellClickAction.SELECT_SQUARE);
        };
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
        return linkStatusVisible;
    }

    public boolean edgeHoverEnabled() {
        return edgeHoverEnabled;
    }

    public boolean autoShowsSelectedRoom() {
        return autoShowsSelectedRoom;
    }

    public boolean autoShowsSelectedArea() {
        return autoShowsSelectedArea;
    }

    public Cursor cursor() {
        return cursor;
    }

    public CellClickAction cellClickAction() {
        return cellClickAction;
    }
}
