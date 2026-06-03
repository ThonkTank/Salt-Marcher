package src.domain.dungeon.model.runtime.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonTransition;

final class DungeonTravelMoveResolverSupport {
    private DungeonTravelMoveResolverSupport() {
    }

    static @Nullable DungeonTransition findTransition(DungeonMap dungeonMap, long transitionId) {
        for (DungeonTransition transition : dungeonMap.connections().transitions()) {
            if (transition != null && transition.transitionId() == transitionId) {
                return transition;
            }
        }
        return null;
    }
}
