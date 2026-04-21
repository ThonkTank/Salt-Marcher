package src.domain.dungeon.map.value;

import java.util.List;

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

    public List<DungeonCell> allCells() {
        return java.util.stream.Stream.concat(
                        areas.stream().flatMap(area -> area.cells().stream()),
                        features.stream().flatMap(feature -> feature.cells().stream()))
                .distinct()
                .toList();
    }
}
