package features.world.quarantine.dungeonmap.editor.session.selection;

import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;

public final class DungeonEditorSelectionPolicy {

    public DungeonSelection selectCluster(DungeonEditorSessionState state, DungeonRoomCluster cluster) {
        return showTarget(
                state,
                cluster == null || cluster.clusterId() == null ? null : DungeonSelection.roomCluster(cluster.clusterId()),
                true);
    }

    public DungeonSelection selectRoom(
            DungeonEditorSessionState state,
            DungeonLayout layout,
            DungeonRoom room
    ) {
        return selectCluster(state, room == null || layout == null ? null : layout.clusterForRoom(room.roomId()));
    }

    public DungeonSelection selectCorridor(
            DungeonEditorSessionState state,
            DungeonCorridor corridor
    ) {
        state.clearCorridorEditSelection();
        return showTarget(
                state,
                corridor == null || corridor.corridorId() == null ? null : DungeonSelection.corridor(corridor.corridorId()),
                false);
    }

    public DungeonSelection selectCorridorDoorHandle(DungeonEditorSessionState state, CorridorDoorHandle handle) {
        if (handle == null) {
            return null;
        }
        state.selectCorridorDoorHandle(handle);
        return showTarget(state, DungeonSelection.corridor(handle.corridorId()), false);
    }

    public DungeonSelection selectCorridorWaypointHandle(DungeonEditorSessionState state, CorridorWaypointHandle handle) {
        if (handle == null) {
            return null;
        }
        state.selectCorridorWaypointHandle(handle);
        return showTarget(state, DungeonSelection.corridor(handle.corridorId()), false);
    }

    public DungeonSelection selectCorridorTargetSelection(
            DungeonEditorSessionState state,
            DungeonLayout layout,
            features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint target
    ) {
        if (layout == null) {
            return null;
        }
        if (target instanceof features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint.Room roomEndpoint) {
            DungeonRoomCluster cluster = layout.clusterForRoom(roomEndpoint.roomId());
            return showTarget(
                    state,
                    cluster == null || cluster.clusterId() == null ? null : DungeonSelection.roomCluster(cluster.clusterId()),
                    true);
        }
        if (target instanceof features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint.Corridor corridorEndpoint) {
            return showTarget(state, DungeonSelection.corridor(corridorEndpoint.corridorId()), false);
        }
        return null;
    }

    public static DungeonSelection focusedTarget(DungeonLayout layout, DungeonLayoutEditResult result) {
        if (layout == null || result == null || result.focusSelection() == null) {
            return null;
        }
        return result.focusSelection().map(
                cluster -> layout.findCluster(cluster.clusterId()) != null ? cluster : null,
                corridor -> layout.findCorridor(corridor.corridorId()) != null ? corridor : null);
    }

    private static DungeonSelection showTarget(
            DungeonEditorSessionState state,
            DungeonSelection target,
            boolean clearCorridorEditSelection
    ) {
        state.setSelectedTarget(target);
        if (target == null || clearCorridorEditSelection) {
            state.clearCorridorEditSelection();
        }
        return target;
    }
}
