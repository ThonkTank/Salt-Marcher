package src.domain.dungeon.api;

/**
 * Stable authored dungeon map identity.
 */
public record DungeonMapId(
        long value
) {

    public DungeonMapId {
        value = Math.max(1L, value);
    }
}
