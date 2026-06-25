package src.features.dungeon.runtime;

import java.util.List;

public interface DungeonEditorControlOperations {
    void setViewMode(String viewModeKey);

    void setTool(String toolKey);

    void cancelActivePreviewSession();

    void shiftProjectionLevel(int levelShift);

    void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels);

    void scrollSelection(int levelDelta);
}
