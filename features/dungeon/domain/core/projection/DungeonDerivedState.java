package features.dungeon.domain.core.projection;

import java.util.List;
import features.dungeon.domain.core.graph.DungeonRelationGraph;
import features.dungeon.domain.core.graph.DungeonTraversalLink;

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
