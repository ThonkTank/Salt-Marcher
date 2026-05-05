package src.view.leftbartabs.dungeoneditor;

public record DungeonEditorControlsViewInputEvent(
        boolean mapSelectionChanged,
        boolean createMapRequested,
        boolean renameMapRequested,
        boolean deleteMapRequested,
        long mapIdValue,
        String mapName,
        boolean viewModeChanged,
        ViewMode viewMode,
        boolean toolChanged,
        Tool tool,
        int projectionLevelShift,
        boolean overlayChanged,
        String overlayModeKey,
        int overlayRange,
        double overlayOpacity,
        String overlayLevelsText
) {

    public DungeonEditorControlsViewInputEvent {
        mapIdValue = Math.max(0L, mapIdValue);
        mapName = mapName == null ? "" : mapName.strip();
        viewMode = viewMode == null ? ViewMode.GRID : viewMode;
        tool = tool == null ? Tool.SELECT : tool;
        overlayModeKey = overlayModeKey == null ? "" : overlayModeKey;
        overlayLevelsText = overlayLevelsText == null ? "" : overlayLevelsText.strip();
    }

    enum ViewMode {
        GRID,
        GRAPH
    }

    enum Tool {
        SELECT,
        ROOM_PAINT,
        ROOM_DELETE,
        WALL_CREATE,
        WALL_DELETE,
        DOOR_CREATE,
        DOOR_DELETE,
        CORRIDOR_CREATE,
        CORRIDOR_DELETE,
        STAIR_CREATE,
        STAIR_DELETE,
        TRANSITION_CREATE,
        TRANSITION_DELETE
    }
}
