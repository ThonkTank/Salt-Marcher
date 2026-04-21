package src.domain.dungeon.published;

public record DungeonBoundarySnapshot(
        String kind,
        long id,
        String label,
        DungeonEdgeRef edge,
        DungeonTopologyElementRef topologyRef
) {

    public DungeonBoundarySnapshot(
            String kind,
            long id,
            String label,
            DungeonEdgeRef edge
    ) {
        this(kind, id, label, edge, defaultTopologyRef(kind, id));
    }

    public DungeonBoundarySnapshot {
        kind = kind == null || kind.isBlank() ? "boundary" : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind : label;
        topologyRef = topologyRef == null
                ? new DungeonTopologyElementRef(boundaryTopologyKind(kind), id)
                : topologyRef;
    }

    private static DungeonTopologyElementKind boundaryTopologyKind(String kind) {
        return "door".equalsIgnoreCase(kind) ? DungeonTopologyElementKind.DOOR : DungeonTopologyElementKind.WALL;
    }

    private static DungeonTopologyElementRef defaultTopologyRef(String kind, long id) {
        String safeKind = kind == null || kind.isBlank() ? "boundary" : kind;
        return new DungeonTopologyElementRef(boundaryTopologyKind(safeKind), Math.max(1L, id));
    }
}
