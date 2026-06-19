package src.features.dungeon.shell;

import java.util.Objects;
import src.domain.dungeon.DungeonEditorProjectionApplicationService;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;

record DungeonEditorLegacyProjectionOperations(
        DungeonEditorProjectionApplicationService projectionEditor
) {
    DungeonEditorLegacyProjectionOperations {
        Objects.requireNonNull(projectionEditor, "projectionEditor");
    }

    void setViewMode(SetDungeonEditorViewModeCommand command) {
        projectionEditor.setViewMode(command);
    }

    void setTool(SetDungeonEditorToolCommand command) {
        projectionEditor.setTool(command);
    }

    void shiftProjectionLevel(ShiftDungeonEditorProjectionLevelCommand command) {
        projectionEditor.shiftProjectionLevel(command);
    }

    void setOverlay(SetDungeonEditorOverlayCommand command) {
        projectionEditor.setOverlay(command);
    }
}
