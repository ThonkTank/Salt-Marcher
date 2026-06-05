package src.domain.dungeon.model.core.projection;

import java.util.List;
import src.domain.dungeon.model.core.geometry.Cell;

/**
 * Identity-bearing authored dungeon area.
 */
public record DungeonState(long id, DungeonAreaType kind, String label, List<Cell> cells) {

    public DungeonState {
        kind = kind == null ? DungeonAreaType.ROOM : kind;
        label = label == null || label.isBlank() ? "Area" : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
