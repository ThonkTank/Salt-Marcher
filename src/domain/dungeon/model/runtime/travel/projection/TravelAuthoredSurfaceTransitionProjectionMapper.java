package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface.TransitionDestination;

final class TravelAuthoredSurfaceTransitionProjectionMapper {

    private TravelAuthoredSurfaceTransitionProjectionMapper() {
    }

    static List<TravelAuthoredSurface.Transition> toTransitions(List<Transition> source) {
        List<TravelAuthoredSurface.Transition> result = new ArrayList<>();
        for (Transition transition : source == null ? List.<Transition>of() : source) {
            if (transition != null) {
                result.add(new TravelAuthoredSurface.Transition(
                        transition.transitionId(),
                        transition.label(),
                        transition.description(),
                        transition.anchor() == null
                                ? null
                                : TravelGeometryProjectionMapper.cellOrOrigin(transition.anchor()),
                        toDestination(transition.destination())));
            }
        }
        return List.copyOf(result);
    }

    private static @Nullable TransitionDestination toDestination(
            src.domain.dungeon.model.core.structure.transition.TransitionDestination destination
    ) {
        if (destination == null) {
            return null;
        }
        if (destination.isOverworldTile()) {
            return TransitionDestination.overworldTile(destination.mapId(), destination.tileId());
        }
        if (destination.isDungeonMap()) {
            return TransitionDestination.dungeonMap(
                    destination.mapId(),
                    destination.transitionId());
        }
        return null;
    }
}
