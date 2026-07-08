package src.domain.dungeon.model.runtime.travel.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurface.TransitionDestination;

final class TravelAuthoredSurfaceTransitionProjectionMapper {

    private TravelAuthoredSurfaceTransitionProjectionMapper() {
    }

    static List<TravelAuthoredSurface.Transition> toTransitions(List<Transition> source) {
        List<TravelAuthoredSurface.Transition> result = new ArrayList<>();
        for (Transition transition : source == null ? List.<Transition>of() : source) {
            if (transition != null) {
                Cell travelCell = transition.anchor().travelCell();
                result.add(new TravelAuthoredSurface.Transition(
                        transition.transitionId(),
                        transition.label(),
                        transition.description(),
                        travelCell == null
                                ? null
                                : TravelGeometryProjectionMapper.cellOrOrigin(travelCell),
                        toDestination(transition.destination())));
            }
        }
        return List.copyOf(result);
    }

    private static TransitionDestination toDestination(
            src.domain.dungeon.model.core.structure.transition.TransitionDestination destination
    ) {
        if (destination == null) {
            return TransitionDestination.unlinkedEntrance();
        }
        if (destination.isUnlinkedEntrance()) {
            return TransitionDestination.unlinkedEntrance();
        }
        if (destination.isOverworldTile()) {
            return TransitionDestination.overworldTile(destination.mapId(), destination.tileId());
        }
        if (destination.isDungeonMap()) {
            return TransitionDestination.dungeonMap(
                    destination.mapId(),
                    destination.transitionTarget());
        }
        return TransitionDestination.unlinkedEntrance();
    }
}
