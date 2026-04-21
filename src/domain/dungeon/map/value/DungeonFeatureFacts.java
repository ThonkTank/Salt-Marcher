package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonFeatureFacts(
        DungeonFeatureType kind,
        long id,
        String label,
        List<DungeonCell> cells,
        String description,
        String destinationLabel,
        DungeonTopologyRef topologyRef
) {

    public DungeonFeatureFacts(
            DungeonFeatureType kind,
            long id,
            String label,
            List<DungeonCell> cells,
            String description,
            String destinationLabel
    ) {
        this(kind, id, label, cells, description, destinationLabel, defaultTopologyRef(kind, id));
    }

    public DungeonFeatureFacts {
        kind = kind == null ? DungeonFeatureType.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(kind), id)
                : topologyRef;
    }

    private static DungeonTopologyRef defaultTopologyRef(DungeonFeatureType kind, long id) {
        DungeonFeatureType safeKind = kind == null ? DungeonFeatureType.STAIR : kind;
        long safeId = Math.max(1L, id);
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(safeKind), safeId);
    }
}
