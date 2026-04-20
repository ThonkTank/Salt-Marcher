package src.domain.dungeon.map;

import src.domain.dungeon.published.DungeonCellRef;

/**
 * Domain-local cell value object.
 */
public record DungeonCell(
        int q,
        int r,
        int level
) {

    public DungeonCellRef toCellRef() {
        return new DungeonCellRef(q, r, level);
    }
}
