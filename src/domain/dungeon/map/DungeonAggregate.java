package src.domain.dungeon.map;

/**
 * Marker for aggregate dungeon owners.
 */
public sealed interface DungeonAggregate permits DungeonRoomAggregate, DungeonCorridorAggregate {

    long id();

    String label();
}
