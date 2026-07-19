package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;

/** Plans one exact room paint or delete rectangle patch. */
public final class RoomRectangleCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            Cell start,
            Cell end,
            boolean deleteMode,
            DungeonIdentityRange clusterIds,
            DungeonIdentityRange roomIds
    ) {
        if (current == null || start == null || end == null || clusterIds == null || roomIds == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        var ids = RoomGeometryPatchPlanner.reservedIds(clusterIds, roomIds);
        return RoomGeometryPatchPlanner.plan(
                current,
                deleteMode
                        ? map -> map.deleteRoomRectangle(start, end, ids)
                        : map -> map.paintRoomRectangle(start, end, ids),
                DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
    }
}
