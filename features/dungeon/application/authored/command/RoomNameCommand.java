package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.util.List;

/** Plans one exact authored room-name patch. */
public final class RoomNameCommand {

    public DungeonCommandResult plan(DungeonMap current, long roomId, String name) {
        if (current == null || roomId <= 0L || name == null || name.isBlank()) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        RoomRegion before = current.rooms().findRoom(roomId).orElse(null);
        if (before == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        RoomRegion after = before.withName(name);
        if (after.equals(before)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new RoomRegionChange(before, after))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
