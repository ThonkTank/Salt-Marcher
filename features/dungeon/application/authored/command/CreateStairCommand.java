package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import java.util.List;

/** Plans creation of one editor-authored stair. */
public final class CreateStairCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long stairId,
            StairGeometrySpec spec
    ) {
        if (current == null || stairId <= 0L || spec == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        if (current.stairs().stair(stairId) != null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (!current.canCreateStair(spec)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        Stair stair = Stair.authored(stairId, current.metadata().mapId().value(), spec);
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new StairChange(null, stair))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
