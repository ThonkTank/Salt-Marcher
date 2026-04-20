package src.domain.dungeon.map;

import src.domain.dungeon.published.DungeonEdgeRef;

/**
 * Primitive wall boundary owner.
 */
public record DungeonWallPrimitive(
        long id,
        DungeonEdgeRef edge
) implements DungeonPrimitive {
}
