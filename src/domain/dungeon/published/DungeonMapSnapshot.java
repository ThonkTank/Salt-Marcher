package src.domain.dungeon.published;

import java.util.List;

public record DungeonMapSnapshot(
        DungeonTopologyKind topology,
        int width,
        int height,
        List<DungeonAreaSnapshot> areas,
        List<DungeonBoundarySnapshot> boundaries,
        List<DungeonFeatureSnapshot> features
) {

    public DungeonMapSnapshot {
        topology = topology == null ? DungeonTopologyKind.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        features = features == null ? List.of() : List.copyOf(features);
    }

    public DungeonMapSnapshot(
            DungeonTopologyKind topology,
            int width,
            int height,
            List<DungeonAreaSnapshot> areas,
            List<DungeonBoundarySnapshot> boundaries
    ) {
        this(topology, width, height, areas, boundaries, List.of());
    }

    public static DungeonMapSnapshot empty() {
        return new DungeonMapSnapshot(DungeonTopologyKind.SQUARE, 1, 1, List.of(), List.of(), List.of());
    }

    public List<DungeonCellRef> allCells() {
        return java.util.stream.Stream.concat(
                        areas.stream().flatMap(area -> area.cells().stream()),
                        features.stream().flatMap(feature -> feature.cells().stream()))
                .toList();
    }
}
