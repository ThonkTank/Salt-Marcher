package src.domain.dungeon.entity;

import src.domain.mapcore.api.MapEdgeRef;

/**
 * Primitive wall boundary owner.
 */
public record DungeonWallPrimitive(
        long id,
        MapEdgeRef edge
) implements DungeonPrimitive {
}
