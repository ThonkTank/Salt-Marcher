package src.domain.dungeon.entity;

import src.domain.dungeon.valueobject.DungeonCell;

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
