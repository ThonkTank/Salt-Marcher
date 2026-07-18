package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorMapAuthoring;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import java.util.Objects;

/** Plans one exact corridor creation patch, including resolved endpoints and bound stairs. */
public final class CreateCorridorCommand {
    private final CorridorMapAuthoring authoring;

    public CreateCorridorCommand(CorridorRoutingPolicy routingPolicy) {
        authoring = new CorridorMapAuthoring(Objects.requireNonNull(routingPolicy, "routingPolicy"));
    }

    public DungeonCommandResult plan(
            DungeonMap current,
            long stairId,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        if (current == null || start == null || end == null) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        return ConnectionPatchPlanner.plan(
                current,
                map -> authoring.createCorridor(map, stairId, start, end),
                DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE);
    }
}
