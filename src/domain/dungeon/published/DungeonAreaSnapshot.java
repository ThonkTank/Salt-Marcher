package src.domain.dungeon.published;

import java.util.List;

public record DungeonAreaSnapshot(
        DungeonAreaKind kind,
        long id,
        long clusterId,
        String label,
        List<DungeonCellRef> cells,
        DungeonTopologyElementRef topologyRef
) {

    public DungeonAreaSnapshot(
            DungeonAreaKind kind,
            long id,
            String label,
            List<DungeonCellRef> cells
    ) {
        this(kind, id, 0L, label, cells);
    }

    public DungeonAreaSnapshot(
            DungeonAreaKind kind,
            long id,
            long clusterId,
            String label,
            List<DungeonCellRef> cells
    ) {
        this(kind, id, clusterId, label, cells, defaultTopologyRef(kind, id));
    }

    public DungeonAreaSnapshot {
        kind = kind == null ? DungeonAreaKind.ROOM : kind;
        id = Math.max(1L, id);
        clusterId = Math.max(0L, clusterId);
        label = label == null || label.isBlank() ? kind.name() : label;
        cells = cells == null ? List.of() : List.copyOf(cells);
        topologyRef = topologyRef == null
                ? new DungeonTopologyElementRef(areaTopologyKind(kind), id)
                : topologyRef;
    }

    private static DungeonTopologyElementKind areaTopologyKind(DungeonAreaKind kind) {
        return kind == DungeonAreaKind.CORRIDOR
                ? DungeonTopologyElementKind.CORRIDOR
                : DungeonTopologyElementKind.ROOM;
    }

    private static DungeonTopologyElementRef defaultTopologyRef(DungeonAreaKind kind, long id) {
        DungeonAreaKind safeKind = kind == null ? DungeonAreaKind.ROOM : kind;
        return new DungeonTopologyElementRef(areaTopologyKind(safeKind), Math.max(1L, id));
    }
}
