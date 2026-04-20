package src.domain.dungeon.map.value;

import java.util.List;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;

/**
 * Derived dungeon lookup and render state built from committed truth.
 */
public record DungeonDerivedState(
        DungeonMapFacts map,
        List<DungeonAggregate> aggregates,
        List<DungeonPrimitive> primitives,
        DungeonRelationGraph relations
) {

    public DungeonDerivedState {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        primitives = primitives == null ? List.of() : List.copyOf(primitives);
    }
}
