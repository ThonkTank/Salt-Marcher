package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonFeatureFacts(
        DungeonFeatureType kind,
        long id,
        String label,
        List<DungeonCell> cells,
        String description,
        String destinationLabel
) {

    public DungeonFeatureFacts {
        kind = kind == null ? DungeonFeatureType.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
    }
}
