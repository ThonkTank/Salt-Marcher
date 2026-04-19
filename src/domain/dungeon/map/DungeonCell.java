package src.domain.dungeon.map;

import src.domain.mapcore.api.MapCellRef;

/**
 * Domain-local cell value object.
 */
public record DungeonCell(
        int q,
        int r,
        int level
) {

    public MapCellRef toMapCellRef() {
        return new MapCellRef(q, r, level);
    }
}
