package src.domain.dungeon.model.worldspace.model;

import java.util.List;

public record DungeonFeatureFacts(
        DungeonFeatureType kind,
        long id,
        String label,
        List<DungeonCell> cells,
        String description,
        String destinationLabel,
        List<String> facts,
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
        this(
                kind == null ? DungeonFeatureType.STAIR : kind,
                Math.max(1L, id),
                label,
                cells,
                description,
                destinationLabel,
                List.of(),
                defaultTopologyRef(kind, id));
    }

    public DungeonFeatureFacts(
            DungeonFeatureType kind,
            long id,
            String label,
            List<DungeonCell> cells,
            String description,
            String destinationLabel,
            List<String> facts
    ) {
        this(
                kind,
                id,
                label,
                cells,
                description,
                destinationLabel,
                facts,
                defaultTopologyRef(kind, id));
    }

    public DungeonFeatureFacts {
        kind = kind == null ? DungeonFeatureType.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        facts = copyFacts(facts);
        topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(kind), id)
                : topologyRef;
    }

    @Override
    public List<String> facts() {
        return List.copyOf(facts);
    }

    private static List<String> copyFacts(List<String> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        List<String> result = new java.util.ArrayList<>();
        for (String fact : source) {
            String normalized = fact == null ? "" : fact.trim();
            if (!normalized.isBlank()) {
                result.add(normalized);
            }
        }
        return List.copyOf(result);
    }

    private static DungeonTopologyRef defaultTopologyRef(DungeonFeatureType kind, long id) {
        DungeonFeatureType resolvedKind = kind == null ? DungeonFeatureType.STAIR : kind;
        long resolvedId = Math.max(1L, id);
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromFeatureType(resolvedKind), resolvedId);
    }
}
