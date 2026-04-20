package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonAreaFacts(
        DungeonAreaType kind,
        long id,
        String label,
        List<DungeonCell> cells
) {

    public DungeonAreaFacts {
        kind = kind == null ? DungeonAreaType.ROOM : kind;
        label = label == null || label.isBlank() ? "Area" : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
