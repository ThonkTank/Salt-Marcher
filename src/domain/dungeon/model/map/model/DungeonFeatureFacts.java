package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

import java.util.List;

public record DungeonFeatureFacts(
        DungeonFeatureType kind,
        long id,
        String label,
        List<DungeonCell> cells,
        String description,
        String destinationLabel,
        @Nullable DungeonTopologyRef topologyRef
) {

    public DungeonFeatureFacts(
            DungeonFeatureType kind,
            long id,
            String label,
            List<DungeonCell> cells,
            String description,
            String destinationLabel
    ) {
        this(
                kind == null ? DungeonFeatureType.STAIR : kind,
                Math.max(1L, id),
                label,
                cells,
                description,
                destinationLabel,
                null);
    }

    public DungeonFeatureFacts {
        kind = kind == null ? DungeonFeatureType.STAIR : kind;
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(kind), id)
                : topologyRef;
    }
}
