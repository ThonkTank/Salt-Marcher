package src.domain.dungeon.model.worldspace;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;

final class ConnectionCatalogTransitionOperations {
    private final java.util.List<DungeonCorridor> corridors;
    private final StairCollection stairCollection;
    private final TransitionCatalog transitionCatalog;

    ConnectionCatalogTransitionOperations(
            java.util.List<DungeonCorridor> corridors,
            StairCollection stairCollection,
            TransitionCatalog transitionCatalog
    ) {
        this.corridors = corridors;
        this.stairCollection = stairCollection;
        this.transitionCatalog = transitionCatalog;
    }

    boolean canCreateTransition(
            DungeonCell anchor,
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
        return transitionCatalog.canCreate(
                anchor == null ? null : anchor.geometry(),
                destination.coreDestination());
    }

    ConnectionCatalog withTransition(
            long transitionId,
            long mapId,
            DungeonCell anchor,
            boolean dungeonMapDestination,
            long destinationMapId,
            long destinationTileId,
            @Nullable Long destinationTransitionId
    ) {
        if (!canCreateTransition(
                anchor,
                dungeonMapDestination,
                destinationMapId,
                destinationTileId,
                destinationTransitionId)) {
            return new ConnectionCatalog(corridors, stairCollection, transitionCatalog);
        }
        TransitionCatalog nextTransitions = transitionCatalog.withCreated(
                transitionId,
                mapId,
                anchor.geometry(),
                transitionDestination(
                        dungeonMapDestination,
                        destinationMapId,
                        destinationTileId,
                        destinationTransitionId).coreDestination());
        return withTransitionCatalog(nextTransitions);
    }

    ConnectionCatalog withMapLocalAuthoredTransitionLink(AuthoredTransitionLink link) {
        return withTransitionCatalog(transitionCatalog.withMapLocalAuthoredTransitionLink(link));
    }

    boolean canDeleteTransition(long transitionId) {
        return transitionCatalog.canDelete(transitionId);
    }

    ConnectionCatalog withoutTransition(long transitionId) {
        return withTransitionCatalog(transitionCatalog.withoutTransition(transitionId));
    }

    ConnectionCatalog withTransitionDescription(long transitionId, String description) {
        return withTransitionCatalog(transitionCatalog.withDescription(transitionId, description));
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

    private ConnectionCatalog withTransitionCatalog(TransitionCatalog nextTransitions) {
        return nextTransitions.equals(transitionCatalog)
                ? new ConnectionCatalog(corridors, stairCollection, transitionCatalog)
                : new ConnectionCatalog(corridors, stairCollection, nextTransitions);
    }
}
