package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorRuntimeControlPort implements DungeonEditorControlOperations {
    private final DungeonEditorRuntimeControlController controller;

    DungeonEditorRuntimeControlPort(DungeonEditorRuntimeControlController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    @Override
    public void setViewMode(String viewModeKey) {
        controller.selectViewMode(toViewMode(viewModeKey));
    }

    @Override
    public void setTool(String toolKey) {
        controller.selectTool(toTool(toolKey));
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
    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        DungeonOverlaySettings overlaySettings =
                new DungeonOverlaySettings(modeKey, levelRange, opacity, selectedLevels);
        controller.setOverlay(overlaySettings);
    }

    @Override
    public void scrollSelection(int levelDelta) {
        controller.scrollSelection(levelDelta);
    }

    private static DungeonEditorTool toTool(String value) {
        DungeonEditorTool tool = DungeonEditorRuntimeEnumTranslator.editorTool(value);
        return tool == null ? DungeonEditorTool.SELECT : tool;
    }

    private static DungeonEditorViewMode toViewMode(String value) {
        return DungeonEditorViewMode.valueOf(DungeonEditorRuntimeEnumTranslator.viewModeName(value));
    }
}
