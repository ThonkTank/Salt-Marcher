package src.domain.dungeon.map.value;

/**
 * Domain-local cell value object.
 */
public record DungeonCell(
        int q,
        int r,
        int level
) {
}
