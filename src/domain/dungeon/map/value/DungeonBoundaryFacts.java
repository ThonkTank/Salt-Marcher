package src.domain.dungeon.map.value;

public record DungeonBoundaryFacts(
        String kind,
        long id,
        String label,
        DungeonEdge edge,
        DungeonTopologyRef topologyRef
) {

    public DungeonBoundaryFacts(
            String kind,
            long id,
            String label,
            DungeonEdge edge
    ) {
        this(kind, id, label, edge, defaultTopologyRef(kind, id));
    }

    public DungeonBoundaryFacts {
        kind = kind == null || kind.isBlank() ? "boundary" : kind;
        label = label == null || label.isBlank() ? "Boundary" : label;
        topologyRef = topologyRef == null
                ? new DungeonTopologyRef(DungeonTopologyElementKind.fromBoundaryKind(kind), id)
                : topologyRef;
    }

    private static DungeonTopologyRef defaultTopologyRef(String kind, long id) {
        String safeKind = kind == null || kind.isBlank() ? "boundary" : kind;
        return new DungeonTopologyRef(DungeonTopologyElementKind.fromBoundaryKind(safeKind), id);
    }
}
