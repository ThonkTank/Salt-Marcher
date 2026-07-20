package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.List;

/** Plans one exact authored transition-description patch. */
public final class TransitionDescriptionCommand {

    public DungeonCommandResult plan(DungeonMap current, long transitionId, String description) {
        if (current == null || transitionId <= 0L) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        Transition before = current.transitionCatalog().transition(transitionId);
        if (before == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        Transition after = before.withDescription(description);
        if (after.equals(before)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.NO_EFFECT);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new TransitionChange(before, after))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
