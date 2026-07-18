package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMap;

/** Plans one exact room paint or delete rectangle patch. */
public final class RoomRectangleCommand {

    public DungeonCommandResult plan(DungeonMap current, Cell start, Cell end, boolean deleteMode) {
        if (current == null || start == null || end == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        return RoomGeometryPatchPlanner.plan(
                current,
                deleteMode
                        ? map -> map.deleteRoomRectangle(start, end)
                        : map -> map.paintRoomRectangle(start, end),
                DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
    }
}
