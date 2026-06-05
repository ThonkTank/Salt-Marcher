package src.domain.dungeon.model.worldspace;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

/**
 * Authored map connections loaded from dungeon write-model truth.
 */
public final class ConnectionCatalog {
    private final List<DungeonCorridor> corridorSources;
    private final StairCollection stairCollection;
    private final TransitionCatalog transitionCatalog;

    public ConnectionCatalog(
            List<DungeonCorridor> corridors,
            List<DungeonStair> stairs,
            List<DungeonTransition> transitions
    ) {
        this(corridors,
                DungeonStair.coreCollection(stairs),
                DungeonTransition.coreCatalog(transitions));
    }

    ConnectionCatalog(
            List<DungeonCorridor> corridors,
            StairCollection stairCollection,
            TransitionCatalog transitionCatalog
    ) {
        this(corridors, stairCollection, transitionCatalog, false);
    }

    private ConnectionCatalog(
            List<DungeonCorridor> corridors,
            StairCollection stairCollection,
            TransitionCatalog transitionCatalog,
            boolean trustedCorridorSources
    ) {
        this.corridorSources = trustedCorridorSources
                ? corridors == null ? List.of() : corridors
                : corridors == null ? List.of() : List.copyOf(corridors);
        this.stairCollection = stairCollection == null ? new StairCollection(List.of()) : stairCollection;
        this.transitionCatalog = transitionCatalog == null ? new TransitionCatalog(List.of()) : transitionCatalog;
    }

    public static ConnectionCatalog empty() {
        return new ConnectionCatalog(List.of(), List.of(), List.of());
    }

    public List<DungeonCorridor> corridors() {
        return List.copyOf(corridorSources);
    }

    public List<DungeonStair> stairs() {
        return DungeonStair.fromCoreCollection(stairCollection);
    }

    public List<DungeonTransition> transitions() {
        return DungeonTransition.fromCoreCatalog(transitionCatalog);
    }

    StairCollection stairCollection() {
        return stairCollection;
    }

    TransitionCatalog transitionCatalog() {
        return transitionCatalog;
    }

    ConnectionCatalog withStairs(StairCollection nextStairs) {
        return new ConnectionCatalog(corridorSources, nextStairs, transitionCatalog, true);
    }

    ConnectionCatalog withTransitions(TransitionCatalog nextTransitions) {
        return new ConnectionCatalog(corridorSources, stairCollection, nextTransitions, true);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof ConnectionCatalog that
                && corridorSources.equals(that.corridorSources)
                && stairCollection.equals(that.stairCollection)
                && transitionCatalog.equals(that.transitionCatalog);
    }

    @Override
    public int hashCode() {
        return Objects.hash(corridorSources, stairCollection, transitionCatalog);
    }
}
