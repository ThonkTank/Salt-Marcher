package features.world.quarantine.dungeonmap.editor.session.selection;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;

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
