package src.domain.dungeon.map;

import java.util.List;
import src.domain.dungeon.published.DungeonMapSnapshot;

/**
 * Derived dungeon lookup and render state built from committed truth.
 */
public record DungeonDerivedState(
        DungeonMapSnapshot map,
        List<DungeonAggregate> aggregates,
        List<DungeonPrimitive> primitives,
        DungeonRelationGraph relations
) {

    public DungeonDerivedState {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        primitives = primitives == null ? List.of() : List.copyOf(primitives);
    }
}
