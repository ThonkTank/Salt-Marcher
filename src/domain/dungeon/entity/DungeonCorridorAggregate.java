package src.domain.dungeon.entity;

import src.domain.dungeon.valueobject.DungeonCell;

import java.util.List;

/**
 * Explicit corridor aggregate truth.
 */
public record DungeonCorridorAggregate(
        long id,
        String label,
        List<DungeonCell> cells
) implements DungeonAggregate {

    public DungeonCorridorAggregate {
        label = label == null || label.isBlank() ? "Corridor" : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
