package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.util.List;

/** Plans creation of one stable authored transition. */
public final class CreateTransitionCommand {

    public DungeonCommandResult plan(
            DungeonMap current,
            long transitionId,
            TransitionAnchor anchor,
            TransitionDestination destination
    ) {
        if (current == null || transitionId <= 0L || anchor == null || destination == null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (current.transitionCatalog().transition(transitionId) != null) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        if (!current.transitionCatalog().canCreate(anchor, destination)) {
            return rejected(DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION);
        }
        Transition transition = new Transition(
                transitionId,
                current.metadata().mapId().value(),
                "",
                anchor,
                destination,
                null);
        return DungeonCommandResult.Accepted.from(DungeonPatch.of(
                current.metadata().mapId(),
                current.revision(),
                List.of(new TransitionChange(null, transition))));
    }

    private static DungeonCommandResult.Rejected rejected(
            DungeonEditorCommandOutcome.RejectionReason reason
    ) {
        return new DungeonCommandResult.Rejected(reason);
    }
}
