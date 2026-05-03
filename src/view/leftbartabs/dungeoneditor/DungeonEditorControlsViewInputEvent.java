package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorControlsViewInputEvent(
        Source source,
        String mapKey,
        String mapName,
        String viewModeKey,
        String tool,
        String overlayModeKey,
        int overlayRange,
        double overlayOpacity,
        List<Integer> overlayLevels
) {

    private static final String DEFAULT_VIEW_MODE_KEY = "Grid";
    private static final String DEFAULT_TOOL = "Auswahl";
    private static final String DEFAULT_OVERLAY_MODE_KEY = "OFF";

    public DungeonEditorControlsViewInputEvent {
        source = source == null ? Source.MAP_SELECTION : source;
        mapKey = mapKey == null ? "" : mapKey;
        mapName = mapName == null ? "" : mapName;
        viewModeKey = viewModeKey == null ? DEFAULT_VIEW_MODE_KEY : viewModeKey;
        tool = tool == null ? DEFAULT_TOOL : tool;
        overlayModeKey = overlayModeKey == null ? DEFAULT_OVERLAY_MODE_KEY : overlayModeKey;
        overlayLevels = overlayLevels == null ? List.of() : List.copyOf(overlayLevels);
    }

    enum Source {
        MAP_SELECTION,
        CREATE_MAP_SUBMIT,
        RENAME_MAP_SUBMIT,
        DELETE_MAP_CONFIRM,
        VIEW_MODE_TOGGLE,
        TOOL_SELECTION,
        PREVIOUS_LEVEL_BUTTON,
        NEXT_LEVEL_BUTTON,
        OVERLAY_MODE_CONTROL,
        OVERLAY_RANGE_CONTROL,
        OVERLAY_OPACITY_CONTROL,
        OVERLAY_LEVEL_SELECTION
    }
}
