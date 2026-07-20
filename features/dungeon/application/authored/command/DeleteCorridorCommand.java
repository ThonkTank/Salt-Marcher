package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorDeletionTarget;
import features.dungeon.domain.core.structure.corridor.CorridorMapAuthoring;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import java.util.Objects;

/** Plans one exact corridor or corridor-branch deletion patch. */
public final class DeleteCorridorCommand {
    private final CorridorMapAuthoring authoring;

    public DeleteCorridorCommand(CorridorRoutingPolicy routingPolicy) {
        authoring = new CorridorMapAuthoring(Objects.requireNonNull(routingPolicy, "routingPolicy"));
    }

    public DungeonCommandResult plan(DungeonMap current, CorridorDeletionTarget target) {
        if (current == null || target == null || !target.hasCorridor()) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        return ConnectionPatchPlanner.plan(
                current,
                map -> authoring.deleteCorridor(map, target),
                DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE);
    }
}
