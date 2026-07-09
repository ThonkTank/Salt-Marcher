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

    static TransitionDestination fromDraft(
            TransitionDestinationType destinationType,
            String mapId,
            String tileId,
            String transitionId
    ) {
        return new TransitionDestination(
                destinationType,
                positiveLong(mapId),
                positiveLong(tileId),
                TransitionDestinationTarget.fromPositiveId(positiveLong(transitionId)).transitionId());
    }

    TransitionDestinationTarget targetTransition() {
        return TransitionDestinationTarget.fromPositiveId(targetTransitionId);
    }

    private static long positiveLong(String value) {
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Math.max(0L, Long.parseLong(value.strip()));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }
}
