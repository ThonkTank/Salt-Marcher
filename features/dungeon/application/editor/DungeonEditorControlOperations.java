package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.DungeonEditorViewMode;

public interface DungeonEditorControlOperations {
    void setViewMode(DungeonEditorViewMode viewMode);

    void setTool(DungeonEditorTool tool);

    void cancelActivePreviewSession();

    void shiftProjectionLevel(int levelShift);

    void setOverlay(DungeonEditorOverlaySettings overlaySettings);

    void scrollSelection(int levelDelta);

    void undo();

    void redo();
}
