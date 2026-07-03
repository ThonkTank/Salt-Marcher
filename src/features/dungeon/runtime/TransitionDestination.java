package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.structure.transition.TransitionDestinationType;

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
        return new TransitionDestination(TransitionDestinationType.UNLINKED_ENTRANCE, 0L, 0L, 0L);
    }

}
