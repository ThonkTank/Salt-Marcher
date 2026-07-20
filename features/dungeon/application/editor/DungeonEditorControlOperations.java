package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public interface DungeonEditorControlOperations {
    void setViewMode(DungeonEditorViewMode viewMode);

    void setTool(DungeonEditorToolSelection selection);

    void cancelActivePreviewSession();

    void shiftProjectionLevel(int levelShift);

    void setOverlay(DungeonOverlaySettings overlaySettings);

    void scrollSelection(int levelDelta);

    void undo();

    void redo();
}
