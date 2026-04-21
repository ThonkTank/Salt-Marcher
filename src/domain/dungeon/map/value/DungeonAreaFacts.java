package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonAreaFacts(
        DungeonAreaType kind,
        long id,
        long clusterId,
        String label,
        List<DungeonCell> cells,
        DungeonTopologyRef topologyRef
) {

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            String label,
            List<DungeonCell> cells
    ) {
        this(kind, id, 0L, label, cells);
    }

    public DungeonAreaFacts(
            DungeonAreaType kind,
            long id,
            long clusterId,
            String label,
            List<DungeonCell> cells
    ) {
        this(kind, id, clusterId, label, cells, defaultTopologyRef(kind, id));
    }

    public DungeonAreaFacts {
        kind = kind == null ? DungeonAreaType.ROOM : kind;
        clusterId = Math.max(0L, clusterId);
        label = label == null || label.isBlank() ? "Area" : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
        topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromAreaType(kind), id)
                : topologyRef;
    }

    private static DungeonTopologyRef defaultTopologyRef(DungeonAreaType kind, long id) {
        DungeonAreaType safeKind = kind == null ? DungeonAreaType.ROOM : kind;
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromAreaType(safeKind), id);
    }
}
