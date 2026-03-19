package features.world.quarantine.dungeonmap.editor.session;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;

public final class DungeonEditorSessionState {

    private DungeonSelection selectedTarget;
    private CorridorDoorHandle selectedCorridorDoorHandle;
    private CorridorWaypointHandle selectedCorridorWaypointHandle;

    public DungeonSelection selectedTarget() {
        return selectedTarget;
    }

    public void setSelectedTarget(DungeonSelection selectedTarget) {
        this.selectedTarget = selectedTarget;
    }

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return selectedCorridorDoorHandle;
    }

    public CorridorWaypointHandle selectedCorridorWaypointHandle() {
        return selectedCorridorWaypointHandle;
    }

    public void clearTransientState() {
        clearCorridorEditSelection();
    }

    public void clearCorridorEditSelection() {
        selectedCorridorDoorHandle = null;
        selectedCorridorWaypointHandle = null;
    }

    public void selectCorridorDoorHandle(CorridorDoorHandle handle) {
        selectedCorridorDoorHandle = handle;
        selectedCorridorWaypointHandle = null;
    }

    public void selectCorridorWaypointHandle(CorridorWaypointHandle handle) {
        selectedCorridorDoorHandle = null;
        selectedCorridorWaypointHandle = handle;
    }

    public DungeonCorridor selectedCorridor(DungeonLayout layout) {
        if (!(selectedTarget instanceof DungeonSelection.Corridor corridorSelection) || layout == null) {
            return null;
        }
        return layout.findCorridor(corridorSelection.corridorId());
    }
}
