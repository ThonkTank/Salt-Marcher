package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;

final class DungeonEditorRuntimeControlActions {
    private DungeonEditorRuntimeControlActions() {
    }

    static DungeonEditorRuntimeOperationResult fromControls(
            DungeonEditorSessionSnapshot.ControlsData controls
    ) {
        return DungeonEditorRuntimeOperationResult.publish(
                new DungeonEditorAction.SelectViewMode(DungeonEditorRuntimeControlValues.viewMode(controls.viewMode())),
                new DungeonEditorAction.SelectTool(DungeonEditorRuntimeControlValues.tool(controls.selectedTool())),
                new DungeonEditorAction.SetProjectionLevel(controls.projectionLevel()),
                new DungeonEditorAction.SetOverlay(DungeonEditorRuntimeControlValues.overlay(controls.overlaySettings())),
                new DungeonEditorAction.SelectMap(DungeonEditorRuntimeControlValues.mapId(controls.selectedMapId())),
                new DungeonEditorAction.SetStatusText(controls.statusText()));
    }
}
