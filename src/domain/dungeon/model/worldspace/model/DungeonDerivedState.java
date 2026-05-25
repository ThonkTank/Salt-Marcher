package src.domain.dungeon.model.worldspace.model;

import java.util.List;

/**
 * Derived dungeon lookup and render state built from committed truth.
 */
public record DungeonDerivedState(
        DungeonMapFacts map,
        List<DungeonState> aggregates,
        List<DungeonPrimitive> primitives,
        DungeonRelationGraph relations,
        List<DungeonTraversalLink> traversalLinks
) {

    public DungeonDerivedState {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        primitives = primitives == null ? List.of() : List.copyOf(primitives);
        traversalLinks = traversalLinks == null ? List.of() : List.copyOf(traversalLinks);
    }

}
