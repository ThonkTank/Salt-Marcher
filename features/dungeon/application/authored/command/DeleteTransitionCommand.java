package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.List;

/** Plans deletion of one unreferenced authored transition. */
public final class DeleteTransitionCommand {

    public DungeonCommandResult plan(DungeonMap current, long transitionId) {
        if (current == null || transitionId <= 0L) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        Transition transition = current.transitionCatalog().transition(transitionId);
        if (transition == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (!current.transitionCatalog().canDelete(transitionId)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.REFERENCED_CONNECTION);
        }
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new TransitionChange(transition, null))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
