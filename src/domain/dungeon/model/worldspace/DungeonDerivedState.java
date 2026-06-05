package src.domain.dungeon.model.worldspace;

import java.util.List;
import src.domain.dungeon.model.core.projection.DungeonMapFacts;

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
