package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

final class DungeonEditorRuntimeControlPort implements DungeonEditorControlOperations {
    private final DungeonEditorRuntimeControlController controller;

    DungeonEditorRuntimeControlPort(DungeonEditorRuntimeControlController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    @Override
    public void setViewMode(DungeonEditorViewMode viewMode) {
        controller.selectViewMode(viewMode);
    }

    @Override
    public void setTool(DungeonEditorTool tool) {
        controller.selectTool(tool);
    }

    @Override
    public void cancelActivePreviewSession() {
        controller.cancelActivePreviewSession();
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        controller.shiftProjectionLevel(levelShift);
    }

    @Override
    public void setOverlay(DungeonEditorOverlaySettings overlaySettings) {
        controller.setOverlay(overlaySettings);
    }

    @Override
    public void scrollSelection(int levelDelta) {
        controller.scrollSelection(levelDelta);
    }

}
