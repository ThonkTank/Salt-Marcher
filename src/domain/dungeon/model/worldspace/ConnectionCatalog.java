package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog.AuthoredTransitionLink;

/**
 * Authored map connections loaded from dungeon write-model truth.
 */
public final class ConnectionCatalog {
    private final List<DungeonCorridor> corridors;
    private final StairCollection stairCollection;
    private final TransitionCatalog transitionCatalog;

    public ConnectionCatalog(
            List<DungeonCorridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        this(corridors,
                DungeonStairCatalogCoreAdapter.toCoreCollection(stairs),
                DungeonTransitionCatalogCoreAdapter.toCoreCatalog(transitions));
    }

    ConnectionCatalog(
            List<DungeonCorridor> corridors,
            StairCollection stairCollection,
            TransitionCatalog transitionCatalog
    ) {
        this.corridors = corridors == null ? List.of() : List.copyOf(corridors);
        this.stairCollection = stairCollection == null ? new StairCollection(List.of()) : stairCollection;
        this.transitionCatalog = transitionCatalog == null ? new TransitionCatalog(List.of()) : transitionCatalog;
    }

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog(List.of(), List.of(), List.of());
    }

    public List<DungeonCorridor> corridors() {
        return List.copyOf(corridors);
    }

    public List<DungeonStair> stairs() {
        return DungeonStairCatalogCoreAdapter.fromCoreCollection(stairCollection);
    }

    public List<DungeonTransition> transitions() {
        return DungeonTransitionCatalogCoreAdapter.fromCoreCatalog(transitionCatalog);
    }

    public ConnectionCatalog withMapLocalAuthoredTransitionLink(AuthoredTransitionLink link) {
        return transitionOperations().withMapLocalAuthoredTransitionLink(link);
    }

    ConnectionCatalogStairOperations stairOperations() {
        return new ConnectionCatalogStairOperations(corridors, stairCollection, transitionCatalog);
    }

    ConnectionCatalogTransitionOperations transitionOperations() {
        return new ConnectionCatalogTransitionOperations(corridors, stairCollection, transitionCatalog);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof ConnectionCatalog that
                && corridors.equals(that.corridors)
                && stairCollection.equals(that.stairCollection)
                && transitionCatalog.equals(that.transitionCatalog);
    }

    @Override
    public int hashCode() {
        return Objects.hash(corridors, stairCollection, transitionCatalog);
    }
}
