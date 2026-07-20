package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import java.util.List;

/** Plans creation of one editor-authored stair. */
public final class CreateStairCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long stairId,
            DungeonIdentityRange stairExitIds,
            StairGeometrySpec spec
    ) {
        if (current == null || stairId <= 0L || stairExitIds == null || spec == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        if (current.stairs().stair(stairId) != null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (!current.canCreateStair(spec)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        Stair stair = Stair.authored(
                stairId,
                current.metadata().mapId().value(),
                spec,
                reservedIds(stairExitIds));
        if (stair.exits().stream().anyMatch(exit -> exit.exitId() <= 0L)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new StairChange(null, stair))));
    }

    static List<Long> reservedIds(DungeonIdentityRange range) {
        java.util.Objects.requireNonNull(range, "range");
        return java.util.stream.IntStream.range(0, range.count())
                .mapToObj(range::idAt)
                .toList();
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
