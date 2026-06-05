package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;

public record DungeonTransition(
        long transitionId,
        long mapId,
        String description,
        @Nullable Cell anchor,
        DungeonTransitionDestination destination,
        @Nullable Long linkedTransitionId
) {

    public DungeonTransition {
        Transition coreTransition = coreTransition(
                transitionId,
                mapId,
                description,
                anchor,
                destination,
                linkedTransitionId);
        transitionId = coreTransition.transitionId();
        mapId = coreTransition.mapId();
        description = coreTransition.description();
        anchor = anchorFromCore(coreTransition);
        destination = DungeonTransitionDestination.fromCore(coreTransition.destination());
        linkedTransitionId = coreTransition.linkedTransitionId();
    }

    public String label() {
        return coreTransition().label();
    }

    public boolean isPlaced() {
        return coreTransition().isPlaced();
    }

    Transition coreTransition() {
        return coreTransition(transitionId, mapId, description, anchor, destination, linkedTransitionId);
    }

    static DungeonTransition fromCore(Transition transition) {
        return new DungeonTransition(
                transition.transitionId(),
                transition.mapId(),
                transition.description(),
                anchorFromCore(transition),
                DungeonTransitionDestination.fromCore(transition.destination()),
                transition.linkedTransitionId());
    }

    static TransitionCatalog coreCatalog(List<DungeonTransition> transitions) {
        List<Transition> result = new ArrayList<>();
        for (DungeonTransition transition : transitions == null ? List.<DungeonTransition>of() : transitions) {
            if (transition != null) {
                result.add(transition.coreTransition());
            }
        }
        return new TransitionCatalog(result);
    }

    static List<DungeonTransition> fromCoreCatalog(TransitionCatalog catalog) {
        List<DungeonTransition> result = new ArrayList<>();
        for (Transition transition : catalog == null ? List.<Transition>of() : catalog.transitions()) {
            result.add(fromCore(transition));
        }
        return List.copyOf(result);
    }

    static boolean canCreate(
            TransitionCatalog transitions,
            Cell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        DungeonTransitionDestination destination = transitionDestination(
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId);
        return normalizedCatalog(transitions).canCreate(
                anchor == null ? null : anchor,
                destination.coreDestination());
    }

    static TransitionCatalog withCreated(
            TransitionCatalog transitions,
            long transitionId,
            long mapId,
            Cell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        if (!canCreate(
                transitions,
                anchor,
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId)) {
            return normalizedCatalog(transitions);
        }
        return normalizedCatalog(transitions).withCreated(
                transitionId,
                mapId,
                anchor,
                transitionDestination(
                        dungeonMapDestination,
                        destinationMapId,
                        destinationTileId,
                        destinationTransitionId).coreDestination());
    }

    static boolean canDelete(TransitionCatalog transitions, long transitionId) {
        return normalizedCatalog(transitions).canDelete(transitionId);
    }

    static TransitionCatalog withoutTransition(TransitionCatalog transitions, long transitionId) {
        return normalizedCatalog(transitions).withoutTransition(transitionId);
    }

    static TransitionCatalog withDescription(TransitionCatalog transitions, long transitionId, String description) {
        return normalizedCatalog(transitions).withDescription(transitionId, description);
    }

    static TransitionCatalog withMapLocalAuthoredTransitionLink(
            TransitionCatalog transitions,
            AuthoredTransitionLink link
    ) {
        return normalizedCatalog(transitions).withMapLocalAuthoredTransitionLink(link);
    }

    private static Transition coreTransition(
            long transitionId,
            long mapId,
            String description,
            @Nullable Cell anchor,
            DungeonTransitionDestination destination,
            @Nullable Long linkedTransitionId
    ) {
        return new Transition(
                transitionId,
                mapId,
                description,
                anchor == null ? null : anchor,
                destination == null
                        ? DungeonTransitionDestination.overworldTileDestination(0L, 0L).coreDestination()
                        : destination.coreDestination(),
                linkedTransitionId);
    }

    private static DungeonTransitionDestination transitionDestination(
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        if (dungeonMapDestination) {
            return DungeonTransitionDestination.dungeonMapDestination(destinationMapId, destinationTransitionId);
        }
        return DungeonTransitionDestination.overworldTileDestination(destinationMapId, destinationTileId);
    }

    private static TransitionCatalog normalizedCatalog(TransitionCatalog transitions) {
        return transitions == null ? new TransitionCatalog(List.of()) : transitions;
    }

    private static @Nullable Cell anchorFromCore(Transition transition) {
        return transition.anchor() == null ? null : transition.anchor();
    }
}
