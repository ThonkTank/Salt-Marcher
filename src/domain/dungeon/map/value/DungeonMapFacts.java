package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonMapFacts(
        DungeonTopology topology,
        int width,
        int height,
        List<DungeonAreaFacts> areas,
        List<DungeonBoundaryFacts> boundaries
) {

    public DungeonMapFacts {
        topology = topology == null ? DungeonTopology.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
    }

    public List<DungeonCell> allCells() {
        return areas.stream()
                .flatMap(area -> area.cells().stream())
                .distinct()
                .toList();
    }
}
