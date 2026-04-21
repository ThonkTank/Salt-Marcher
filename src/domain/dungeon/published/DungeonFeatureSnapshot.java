package src.domain.dungeon.published;

import java.util.List;

public record DungeonFeatureSnapshot(
        DungeonFeatureKind kind,
        long id,
        String label,
        List<DungeonCellRef> cells,
        String description,
        String destinationLabel
) {

    public DungeonFeatureSnapshot {
        kind = kind == null ? DungeonFeatureKind.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
    }
}
