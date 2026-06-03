package src.domain.dungeon.model.worldspace;

import java.util.List;

/**
 * Derived dungeon lookup and render state built from committed truth.
 */
public record DungeonDerivedState(
        DungeonMapFacts map,
        List<DungeonState> aggregates,
        DungeonRelationGraph relations,
        List<DungeonTraversalLink> traversalLinks
) {

    public DungeonDerivedState {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        traversalLinks = traversalLinks == null ? List.of() : List.copyOf(traversalLinks);
    }

}
