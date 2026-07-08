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
        this(kind, id, label, edge, DungeonTopologyElementRef.empty());
    }

    public DungeonBoundarySnapshot {
        kind = kind == null || kind.isBlank() ? "boundary" : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind : label;
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
    }
}
