package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonAreaFacts(
        DungeonAreaType kind,
        long id,
        long clusterId,
        String label,
        List<DungeonCell> cells
) {

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            String label,
            List<DungeonCell> cells
    ) {
        this(kind, id, 0L, label, cells);
    }

    public DungeonAreaFacts {
        kind = kind == null ? DungeonAreaType.ROOM : kind;
        clusterId = Math.max(0L, clusterId);
        label = label == null || label.isBlank() ? "Area" : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
