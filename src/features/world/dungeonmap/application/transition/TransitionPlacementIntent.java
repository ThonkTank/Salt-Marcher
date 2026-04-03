package features.world.dungeonmap.application.transition;

import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;

public sealed interface TransitionPlacementIntent
        permits TransitionPlacementIntent.Create, TransitionPlacementIntent.PlacePrepared {

    record Create(
            String description,
            DungeonTransitionDestination destination,
            boolean bidirectional
    ) implements TransitionPlacementIntent {
    }

    record PlacePrepared(long transitionId) implements TransitionPlacementIntent {
    }
}
