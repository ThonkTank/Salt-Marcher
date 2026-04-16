package src.domain.dungeon.entity;

import src.domain.mapcore.api.MapSurfaceSnapshot;

import java.util.List;

/**
 * Derived dungeon lookup and render state built from committed truth.
 */
public record DungeonDerivedState(
        MapSurfaceSnapshot surface,
        List<DungeonAggregate> aggregates,
        List<DungeonPrimitive> primitives,
        DungeonRelationGraph relations
) {

    public DungeonDerivedState {
        aggregates = aggregates == null ? List.of() : List.copyOf(aggregates);
        primitives = primitives == null ? List.of() : List.copyOf(primitives);
    }
}
