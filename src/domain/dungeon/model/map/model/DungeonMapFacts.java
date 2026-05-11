package src.domain.dungeon.model.map.model;

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
        java.util.ArrayList<DungeonCell> result = new java.util.ArrayList<>();
        appendUniqueAreaCells(result);
        appendUniqueFeatureCells(result);
        return List.copyOf(result);
    }

    private void appendUniqueAreaCells(List<DungeonCell> result) {
        for (DungeonAreaFacts area : areas) {
            if (area == null) {
                continue;
            }
            appendUniqueCells(result, area.cells());
        }
    }

    private void appendUniqueFeatureCells(List<DungeonCell> result) {
        for (DungeonFeatureFacts feature : features) {
            if (feature == null) {
                continue;
            }
            appendUniqueCells(result, feature.cells());
        }
    }

    private static void appendUniqueCells(List<DungeonCell> result, List<DungeonCell> cells) {
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null && !result.contains(cell)) {
                result.add(cell);
            }
        }
    }
}
