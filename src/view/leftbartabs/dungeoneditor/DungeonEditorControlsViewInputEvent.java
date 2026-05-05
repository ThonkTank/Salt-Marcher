package src.view.leftbartabs.dungeoneditor;

import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;

public record DungeonEditorControlsViewInputEvent(
        boolean mapSelectionChanged,
        boolean createMapRequested,
        boolean renameMapRequested,
        boolean deleteMapRequested,
        long mapIdValue,
        String mapName,
        boolean viewModeChanged,
        DungeonEditorViewMode viewMode,
        boolean toolChanged,
        DungeonEditorTool tool,
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
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        tool = tool == null ? DungeonEditorTool.SELECT : tool;
        overlayModeKey = overlayModeKey == null ? "" : overlayModeKey;
        overlayLevelsText = overlayLevelsText == null ? "" : overlayLevelsText.strip();
    }
}
