package src.domain.dungeon.published;

import java.util.List;

public record DungeonAreaSnapshot(
        DungeonAreaKind kind,
        long id,
        String label,
        List<DungeonCellRef> cells
) {

    public DungeonAreaSnapshot {
        kind = kind == null ? DungeonAreaKind.ROOM : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
