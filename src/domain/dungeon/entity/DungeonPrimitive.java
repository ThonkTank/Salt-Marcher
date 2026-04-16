package src.domain.dungeon.entity;

/**
 * Marker for single-identity dungeon objects.
 */
public sealed interface DungeonPrimitive permits DungeonWallPrimitive, DungeonDoorPrimitive {

    long id();
}
