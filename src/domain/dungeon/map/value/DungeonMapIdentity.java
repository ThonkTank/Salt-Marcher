package src.domain.dungeon.map.value;

/**
 * Domain-local authored dungeon map identity.
 */
public record DungeonMapIdentity(
        long value
) {

    public DungeonMapIdentity {
        value = Math.max(1L, value);
    }
}
