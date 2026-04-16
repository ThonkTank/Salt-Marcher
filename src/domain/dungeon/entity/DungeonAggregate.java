package src.domain.dungeon.entity;

/**
 * Marker for aggregate dungeon owners.
 */
public sealed interface DungeonAggregate permits DungeonRoomAggregate, DungeonCorridorAggregate {

    long id();

    String label();
}
