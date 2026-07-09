package src.domain.dungeon.model.core.projection;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public record DungeonFeatureFacts(
        DungeonFeatureType kind,
        long id,
        String label,
        List<Cell> cells,
        String description,
        String destinationLabel,
        List<String> facts,
        DungeonTopologyRef topologyRef,
        @Nullable Edge anchorEdge
) {

    public DungeonFeatureFacts(
            DungeonFeatureType kind,
            long id,
            String label,
            List<Cell> cells,
            String description,
            String destinationLabel,
            List<String> facts,
            DungeonTopologyRef topologyRef
    ) {
        this(kind, id, label, cells, description, destinationLabel, facts, topologyRef, null);
    }

    public DungeonFeatureFacts {
        kind = kind == null ? DungeonFeatureType.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        facts = copyFacts(facts);
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
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

}
