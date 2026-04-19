package src.domain.dungeon.map;

/**
 * Marker for single-identity dungeon objects.
 */
public sealed interface DungeonPrimitive permits DungeonWallPrimitive, DungeonDoorPrimitive {

    long id();
}
