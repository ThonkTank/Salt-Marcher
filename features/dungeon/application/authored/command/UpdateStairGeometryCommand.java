package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import java.util.List;

/** Plans a full deterministic geometry recompute for one editor-authored stair. */
public final class UpdateStairGeometryCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long stairId,
            DungeonIdentityRange newStairExitIds,
            StairGeometrySpec spec
    ) {
        if (current == null || stairId <= 0L || newStairExitIds == null || spec == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        Stair before = current.stairs().stair(stairId);
        if (before == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (!current.canSaveStairGeometry(stairId, spec)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        Stair after = before.withRecomputedGeometry(
                spec,
                CreateStairCommand.reservedIds(newStairExitIds));
        if (after.exits().stream().anyMatch(exit -> exit.exitId() <= 0L)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        if (after.equals(before)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new StairChange(before, after))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
