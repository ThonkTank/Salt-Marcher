package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

public interface DungeonEditorControlOperations {
    void setViewMode(DungeonEditorViewMode viewMode);

    void setTool(DungeonEditorTool tool);

    void cancelActivePreviewSession();

    void shiftProjectionLevel(int levelShift);

    void setOverlay(DungeonEditorOverlaySettings overlaySettings);

    void scrollSelection(int levelDelta);
}
