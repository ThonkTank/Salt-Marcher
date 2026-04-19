package src.domain.dungeon.map;

import java.util.List;

/**
 * Explicit room aggregate truth.
 */
public record DungeonRoomAggregate(
        long id,
        String label,
        List<DungeonCell> cells
) implements DungeonAggregate {

    public DungeonRoomAggregate {
        label = label == null || label.isBlank() ? "Room" : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
