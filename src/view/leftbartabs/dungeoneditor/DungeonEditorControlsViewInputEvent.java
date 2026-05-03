package src.view.leftbartabs.dungeoneditor;

public record DungeonEditorControlsViewInputEvent(
        boolean mapSelectionChanged,
        boolean createMapRequested,
        boolean renameMapRequested,
        boolean deleteMapRequested,
        long mapIdValue,
        String mapName,
        boolean viewModeChanged,
        String viewModeKey,
        boolean toolChanged,
        String tool,
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
        viewModeKey = viewModeKey == null ? "" : viewModeKey;
        tool = tool == null ? "" : tool;
        overlayModeKey = overlayModeKey == null ? "" : overlayModeKey;
        overlayLevelsText = overlayLevelsText == null ? "" : overlayLevelsText.strip();
    }
}
