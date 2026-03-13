package features.world.dungeonmap.ui.editor.controls;

import features.world.dungeonmap.ui.editor.DungeonColorRenderMode;
import javafx.scene.Cursor;

public enum DungeonEditorTool {
    SELECT("Auswahl", "Auswahl", false, false, false, false, false, Cursor.DEFAULT, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.NONE),
    PAINT("Malen", "Malen", true, true, true, false, false, Cursor.CROSSHAIR, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.PAINT),
    ERASE("Löschen", "Löschen", true, false, true, false, false, Cursor.CROSSHAIR, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.PAINT),
    WALL("Wände", "Wandeditor", false, false, false, false, true, Cursor.HAND, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.WALL),
    AREA_ASSIGN("Bereich", "Bereich", false, false, false, true, false, Cursor.DEFAULT, CellClickAction.ASSIGN_ROOM_AREA, ModeDropdownTarget.NONE),
    FEATURE("Feature", "Feature", false, false, false, false, false, Cursor.HAND, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.NONE),
    PASSAGE("Durchgänge", "Durchgänge", false, false, false, false, true, Cursor.HAND, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.PASSAGE),
    ENDPOINT("Übergang", "Übergang", false, false, false, false, false, Cursor.HAND, CellClickAction.CREATE_OR_SELECT_ENDPOINT, ModeDropdownTarget.NONE),
    LINK("Link", "Link", false, false, false, false, false, Cursor.HAND, CellClickAction.SELECT_SQUARE, ModeDropdownTarget.NONE);

    public enum CellClickAction {
        SELECT_SQUARE,
        ASSIGN_ROOM_AREA,
        CREATE_OR_SELECT_ENDPOINT
    }

    public enum ModeDropdownTarget {
        NONE,
        PAINT,
        WALL,
        PASSAGE
    }

    private final String toolbarLabel;
    private final String panelTitle;
    private final boolean brushTool;
    private final boolean fillsSquares;
    private final boolean brushSettingsVisible;
    private final boolean areaSettingsVisible;
    private final boolean edgeHoverEnabled;
    private final Cursor cursor;
    private final CellClickAction cellClickAction;
    private final ModeDropdownTarget modeDropdownTarget;

    DungeonEditorTool(
            String toolbarLabel,
            String panelTitle,
            boolean brushTool,
            boolean fillsSquares,
            boolean brushSettingsVisible,
            boolean areaSettingsVisible,
            boolean edgeHoverEnabled,
            Cursor cursor,
            CellClickAction cellClickAction,
            ModeDropdownTarget modeDropdownTarget
    ) {
        this.toolbarLabel = toolbarLabel;
        this.panelTitle = panelTitle;
        this.brushTool = brushTool;
        this.fillsSquares = fillsSquares;
        this.brushSettingsVisible = brushSettingsVisible;
        this.areaSettingsVisible = areaSettingsVisible;
        this.edgeHoverEnabled = edgeHoverEnabled;
        this.cursor = cursor;
        this.cellClickAction = cellClickAction;
        this.modeDropdownTarget = modeDropdownTarget;
    }

    public String toolbarLabel() {
        return toolbarLabel;
    }

    public String panelTitle() {
        return panelTitle;
    }

    public boolean isBrushTool() {
        return brushTool;
    }

    public boolean fillsSquares() {
        return fillsSquares;
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

    public boolean autoShowsSelectedArea() {
        return this == AREA_ASSIGN;
    }

    public boolean featureSettingsVisible() {
        return this == FEATURE;
    }

    public DungeonColorRenderMode preferredColorRenderMode() {
        return switch (this) {
            case PAINT, ERASE -> DungeonColorRenderMode.ROOMS;
            case AREA_ASSIGN -> DungeonColorRenderMode.AREAS;
            default -> null;
        };
    }

    public Cursor cursor() {
        return cursor;
    }

    public CellClickAction cellClickAction() {
        return cellClickAction;
    }

    public ModeDropdownTarget modeDropdownTarget() {
        return modeDropdownTarget;
    }
}
