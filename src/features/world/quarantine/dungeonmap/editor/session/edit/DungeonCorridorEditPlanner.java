package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;

import java.util.List;

public final class DungeonCorridorEditPlanner {

    private DungeonCorridorEditPlanner() {
        throw new AssertionError("No instances");
    }

    public static DungeonEditorEditPlan planCorridorSelection(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint target,
            DungeonLayout layout
    ) {
        if (start == null || target == null) {
            return new DungeonEditorEditPlan.NoOp();
        }
        if (start instanceof DungeonCorridorEndpoint.Room startRoom && target instanceof DungeonCorridorEndpoint.Room targetRoom) {
            return new DungeonEditorEditPlan.Execute(
                    new DungeonEditorEditCommand.CreateCorridor(List.of(startRoom.roomId(), targetRoom.roomId())));
        }
        if (start instanceof DungeonCorridorEndpoint.Corridor startCorridor
                && target instanceof DungeonCorridorEndpoint.Corridor targetCorridor) {
            return new DungeonEditorEditPlan.Execute(
                    new DungeonEditorEditCommand.MergeCorridors(targetCorridor.corridorId(), startCorridor.corridorId()));
        }
        if (start instanceof DungeonCorridorEndpoint.Corridor && target instanceof DungeonCorridorEndpoint.Room) {
            return planCorridorSelection(target, start, layout);
        }
        if (!(start instanceof DungeonCorridorEndpoint.Room startRoom)
                || !(target instanceof DungeonCorridorEndpoint.Corridor targetCorridor)) {
            return new DungeonEditorEditPlan.NoOp();
        }
        long roomId = startRoom.roomId();
        long corridorId = targetCorridor.corridorId();
        DungeonCorridor corridor = layout == null ? null : layout.findCorridor(corridorId);
        if (corridor != null && corridor.roomIds().contains(roomId)) {
            return new DungeonEditorEditPlan.SelectCorridorTarget(target);
        }
        return new DungeonEditorEditPlan.Execute(new DungeonEditorEditCommand.AddRoomToCorridor(corridorId, roomId));
    }
}
