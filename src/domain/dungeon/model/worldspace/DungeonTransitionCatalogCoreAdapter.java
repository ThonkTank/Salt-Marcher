package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionEndpoint;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.TransitionLinkDirectionality;

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

    static List<DungeonTransition> withMapLocalAuthoredTransitionLink(
            List<DungeonTransition> transitions,
            AuthoredTransitionLink link
    ) {
        return fromCoreCatalog(toCoreCatalog(transitions).withMapLocalAuthoredTransitionLink(link));
    }

    static AuthoredTransitionLink authoredTransitionLink(
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        return new AuthoredTransitionLink(
                new TransitionEndpoint(sourceMapId, sourceTransitionId),
                new TransitionEndpoint(targetMapId, targetTransitionId),
                bidirectional ? TransitionLinkDirectionality.BIDIRECTIONAL : TransitionLinkDirectionality.ONE_WAY);
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
