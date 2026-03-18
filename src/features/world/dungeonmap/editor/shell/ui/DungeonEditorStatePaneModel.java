package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.corridors.model.DungeonCorridor;

/**
 * Read-only sidebar snapshot published by the editor session coordinator.
 */
public record DungeonEditorStatePaneModel(
        DungeonEditorTool activeTool,
        DungeonCorridor selectedCorridor,
        CorridorDoorHandle selectedDoorHandle,
        CorridorWaypointHandle selectedWaypointHandle
) {
}
