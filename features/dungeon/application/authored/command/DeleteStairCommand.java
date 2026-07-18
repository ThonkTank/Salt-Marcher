package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.stair.Stair;
import java.util.List;

/** Plans deletion of one unbound editor-authored stair. */
public final class DeleteStairCommand {

    public DungeonCommandResult plan(DungeonMap current, long stairId) {
        if (current == null || stairId <= 0L) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        Stair stair = current.stairs().stair(stairId);
        if (stair == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (!current.stairs().canDeleteUnboundStair(stairId)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new StairChange(stair, null))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
