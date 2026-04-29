package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorControlsViewInputEvent(
        Kind kind,
        String mapKey,
        String mapName,
        String viewModeKey,
        String tool,
        int overlayRange,
        double overlayOpacity,
        List<Integer> overlayLevels
) {

    private static final String DEFAULT_VIEW_MODE_KEY = "Grid";
    private static final String DEFAULT_TOOL = "Auswahl";

    public DungeonEditorControlsViewInputEvent {
        kind = kind == null ? Kind.REFRESH : kind;
        mapKey = mapKey == null ? "" : mapKey;
        mapName = mapName == null ? "" : mapName;
        viewModeKey = viewModeKey == null ? DEFAULT_VIEW_MODE_KEY : viewModeKey;
        tool = tool == null ? DEFAULT_TOOL : tool;
        overlayLevels = overlayLevels == null ? List.of() : List.copyOf(overlayLevels);
    }

    static DungeonEditorControlsViewInputEvent refresh() {
        return new DungeonEditorControlsViewInputEvent(Kind.REFRESH, "", "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent selectMap(String mapKey) {
        return new DungeonEditorControlsViewInputEvent(Kind.SELECT_MAP, mapKey, "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent createMap(String mapName) {
        return new DungeonEditorControlsViewInputEvent(Kind.CREATE_MAP, "", mapName, DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent renameMap(String mapKey, String mapName) {
        return new DungeonEditorControlsViewInputEvent(Kind.RENAME_MAP, mapKey, mapName, DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent deleteMap(String mapKey) {
        return new DungeonEditorControlsViewInputEvent(Kind.DELETE_MAP, mapKey, "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent selectViewMode(String viewModeKey) {
        return new DungeonEditorControlsViewInputEvent(Kind.SELECT_VIEW_MODE, "", "", viewModeKey,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent selectTool(String tool) {
        return new DungeonEditorControlsViewInputEvent(Kind.SELECT_TOOL, "", "", DEFAULT_VIEW_MODE_KEY,
                tool, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent previousLevel() {
        return new DungeonEditorControlsViewInputEvent(Kind.PREVIOUS_LEVEL, "", "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent nextLevel() {
        return new DungeonEditorControlsViewInputEvent(Kind.NEXT_LEVEL, "", "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent overlayModeChanged(String modeKey) {
        return new DungeonEditorControlsViewInputEvent(
                Kind.OVERLAY_MODE_CHANGED,
                "",
                "",
                modeKey == null ? "OFF" : modeKey,
                DEFAULT_TOOL,
                0,
                0.0,
                List.of());
    }

    static DungeonEditorControlsViewInputEvent overlayRangeChanged(int levelRange) {
        return new DungeonEditorControlsViewInputEvent(Kind.OVERLAY_RANGE_CHANGED, "", "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, levelRange, 0.0, List.of());
    }

    static DungeonEditorControlsViewInputEvent overlayOpacityChanged(double opacity) {
        return new DungeonEditorControlsViewInputEvent(Kind.OVERLAY_OPACITY_CHANGED, "", "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, opacity, List.of());
    }

    static DungeonEditorControlsViewInputEvent overlayLevelsChanged(List<Integer> levels) {
        return new DungeonEditorControlsViewInputEvent(Kind.OVERLAY_LEVELS_CHANGED, "", "", DEFAULT_VIEW_MODE_KEY,
                DEFAULT_TOOL, 0, 0.0, levels);
    }

    enum Kind {
        REFRESH,
        SELECT_MAP,
        CREATE_MAP,
        RENAME_MAP,
        DELETE_MAP,
        SELECT_VIEW_MODE,
        SELECT_TOOL,
        PREVIOUS_LEVEL,
        NEXT_LEVEL,
        OVERLAY_MODE_CHANGED,
        OVERLAY_RANGE_CHANGED,
        OVERLAY_OPACITY_CHANGED,
        OVERLAY_LEVELS_CHANGED
    }
}
