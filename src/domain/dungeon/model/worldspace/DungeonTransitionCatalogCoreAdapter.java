package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

final class DungeonTransitionCatalogCoreAdapter {

    private DungeonTransitionCatalogCoreAdapter() {
    }

    static boolean canCreate(
            DungeonCell anchor,
            DungeonTransitionDestination destination
    ) {
        return new TransitionCatalog(List.of()).canCreate(
                anchor == null ? null : anchor.geometry(),
                destination == null ? null : destination.coreDestination());
    }

    static List<DungeonTransition> withCreated(
            List<DungeonTransition> transitions,
            long transitionId,
            long mapId,
            DungeonCell anchor,
            DungeonTransitionDestination destination
    ) {
        Cell coreAnchor = anchor == null ? null : anchor.geometry();
        return fromCoreCatalog(toCoreCatalog(transitions).withCreated(
                transitionId,
                mapId,
                coreAnchor,
                destination == null ? null : destination.coreDestination()));
    }

    static boolean canDelete(List<DungeonTransition> transitions, long transitionId) {
        return toCoreCatalog(transitions).canDelete(transitionId);
    }

    static List<DungeonTransition> withoutTransition(List<DungeonTransition> transitions, long transitionId) {
        return fromCoreCatalog(toCoreCatalog(transitions).withoutTransition(transitionId));
    }

    static List<DungeonTransition> withTransition(
            List<DungeonTransition> transitions,
            DungeonTransition replacement
    ) {
        return fromCoreCatalog(toCoreCatalog(transitions).withTransition(
                replacement == null ? null : replacement.coreTransition()));
    }

    static List<DungeonTransition> withoutReverseLinksTo(
            List<DungeonTransition> transitions,
            long transitionId
    ) {
        return fromCoreCatalog(toCoreCatalog(transitions).withoutReverseLinksTo(transitionId));
    }

    private static TransitionCatalog toCoreCatalog(List<DungeonTransition> transitions) {
        List<Transition> result = new ArrayList<>();
        for (DungeonTransition transition : transitions == null ? List.<DungeonTransition>of() : transitions) {
            if (transition != null) {
                result.add(transition.coreTransition());
            }
        }
        return new TransitionCatalog(result);
    }

    private static List<DungeonTransition> fromCoreCatalog(TransitionCatalog catalog) {
        List<DungeonTransition> result = new ArrayList<>();
        for (Transition transition : catalog == null ? List.<Transition>of() : catalog.transitions()) {
            result.add(DungeonTransition.fromCore(transition));
        }
        return List.copyOf(result);
    }
}
