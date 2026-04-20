package src.domain.dungeon.published;

import java.util.List;

public record DungeonMapSnapshot(
        DungeonTopologyKind topology,
        int width,
        int height,
        List<DungeonAreaSnapshot> areas,
        List<DungeonBoundarySnapshot> boundaries
) {

    public DungeonMapSnapshot {
        topology = topology == null ? DungeonTopologyKind.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
    }

    public static DungeonMapSnapshot empty() {
        return new DungeonMapSnapshot(DungeonTopologyKind.SQUARE, 1, 1, List.of(), List.of());
    }

    public List<DungeonCellRef> allCells() {
        return areas.stream()
                .flatMap(area -> area.cells().stream())
                .toList();
    }
}
