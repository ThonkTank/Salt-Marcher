package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.structure.transition.TransitionDestinationType;
import src.domain.dungeon.model.core.structure.transition.TransitionDestinationTarget;

public record TransitionDestination(
        TransitionDestinationType destinationType,
        long targetMapId,
        long targetTileId,
        long targetTransitionId
) {
    public TransitionDestination {
        destinationType = destinationType == null
                ? TransitionDestinationType.UNLINKED_ENTRANCE
                : destinationType;
        targetMapId = Math.max(0L, targetMapId);
        targetTileId = Math.max(0L, targetTileId);
        targetTransitionId = Math.max(0L, targetTransitionId);
    }

    public static TransitionDestination empty() {
        return unlinkedEntrance();
    }

    public static TransitionDestination unlinkedEntrance() {
        return new TransitionDestination(TransitionDestinationType.UNLINKED_ENTRANCE, 0L, 0L, 0L);
    }

    static TransitionDestination fromDraftInput(TransitionDestinationDraftInput input) {
        TransitionDestinationDraftInput safeInput = input == null
                ? TransitionDestinationDraftInput.unlinkedEntrance()
                : input;
        return new TransitionDestination(
                safeInput.destinationType(),
                safeInput.targetMapId(),
                safeInput.targetTileId(),
                TransitionDestinationTarget.fromPositiveId(safeInput.targetTransitionId()).transitionId());
    }

    TransitionDestinationTarget targetTransition() {
        return TransitionDestinationTarget.fromPositiveId(targetTransitionId);
    }

}
