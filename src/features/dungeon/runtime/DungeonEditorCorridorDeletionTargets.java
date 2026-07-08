package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.structure.corridor.CorridorDeletionTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;

final class DungeonEditorCorridorDeletionTargets {
    private DungeonEditorCorridorDeletionTargets() {
    }

    static CorridorDeletionTarget deletionTarget(PendingCorridorTarget target) {
        if (target == null || !DungeonEditorWorkspaceValues.hasId(target.deleteCorridorId())) {
            return null;
        }
        return deletionTarget(target.deleteCorridorId(), target.selection().handleRef());
    }

    private static CorridorDeletionTarget deletionTarget(
            long corridorId,
            DungeonEditorWorkspaceValues.HandleRef handle
    ) {
        if (handle.kind() == DungeonEditorHandleType.DOOR) {
            return doorDeletionTarget(corridorId, handle);
        }
        if (handle.kind() == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
            return corridorAnchorDeletionTarget(corridorId, handle);
        }
        if (handle.kind() == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
            return CorridorDeletionTarget.corridorWaypoint(corridorId, handle.index());
        }
        return wholeCorridorDeletionTarget(corridorId, handle);
    }

    private static CorridorDeletionTarget doorDeletionTarget(
            long corridorId,
            DungeonEditorWorkspaceValues.HandleRef handle
    ) {
        if (handle.topologyRef().present() || DungeonEditorWorkspaceValues.hasId(handle.roomId())) {
            return CorridorDeletionTarget.doorBinding(corridorId, handle.topologyRef().id(), handle.roomId());
        }
        return null;
    }

    private static CorridorDeletionTarget corridorAnchorDeletionTarget(
            long corridorId,
            DungeonEditorWorkspaceValues.HandleRef handle
    ) {
        return handle.topologyRef().present()
                ? CorridorDeletionTarget.corridorAnchor(corridorId, handle.topologyRef().id())
                : null;
    }

    private static CorridorDeletionTarget wholeCorridorDeletionTarget(
            long corridorId,
            DungeonEditorWorkspaceValues.HandleRef handle
    ) {
        return !handle.topologyRef().present() && !DungeonEditorWorkspaceValues.hasId(handle.corridorId())
                ? CorridorDeletionTarget.wholeCorridor(corridorId)
                : null;
    }
}
