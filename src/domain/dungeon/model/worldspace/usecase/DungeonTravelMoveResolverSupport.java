package src.domain.dungeon.model.worldspace.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonTransition;
import src.domain.dungeon.model.worldspace.model.DungeonTravelActionFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelMoveFacts;
import src.domain.dungeon.model.worldspace.model.DungeonTravelMoveStatus;
import src.domain.dungeon.model.worldspace.model.DungeonTravelSurfaceFacts;

final class DungeonTravelMoveResolverSupport {
    private DungeonTravelMoveResolverSupport() {
    }

    static @Nullable DungeonTravelActionFacts findAction(DungeonTravelSurfaceFacts currentSurface, String actionId) {
        for (DungeonTravelActionFacts candidate : currentSurface.actions()) {
            if (candidate.actionId().equals(actionId)) {
                return candidate;
            }
        }
        return null;
    }

    static @Nullable DungeonTransition findTransition(DungeonMap dungeonMap, long transitionId) {
        for (DungeonTransition transition : dungeonMap.connections().transitions()) {
            if (transition != null && transition.transitionId() == transitionId) {
                return transition;
            }
        }
        return null;
    }

    static DungeonTravelMoveFacts moveResult(
            DungeonTravelMoveStatus status,
            String message,
            DungeonTravelSurfaceFacts surface,
            @Nullable DungeonTravelExternalTargetFacts externalTarget
    ) {
        return new DungeonTravelMoveFacts(status, message, surface, externalTarget);
    }
}
