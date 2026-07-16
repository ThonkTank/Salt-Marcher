package features.dungeon.domain.core.projection;

import java.util.List;
import features.dungeon.domain.core.geometry.DungeonTopology;

public record DungeonMapFacts(
        DungeonTopology topology,
        int width,
        int height,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries,
        List<DungeonFeatureFacts> features
) {

    public DungeonMapFacts {
        topology = topology == null ? DungeonTopology.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        features = features == null ? List.of() : List.copyOf(features);
    }

    public DungeonMapFacts(
            DungeonTopology topology,
            int width,
            int height,
            List<DungeonAreaFacts> areas,
            List<DungeonBoundaryFacts> boundaries
    ) {
        this(topology, width, height, areas, boundaries, List.of());
    }

}
