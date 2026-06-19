package src.domain.dungeon.published;

public record DungeonEditorHandleRef(
        DungeonEditorHandleKind kind,
        DungeonTopologyElementRef topologyRef,
        long ownerId,
        long clusterId,
        long corridorId,
        long roomId,
        int index,
        DungeonCellRef cell,
        String direction,
        DungeonEdgeRef sourceEdge
) {
    public DungeonEditorHandleRef(
            DungeonEditorHandleKind kind,
            DungeonTopologyElementRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            DungeonCellRef cell,
            String direction
    ) {
        this(kind, topologyRef, ownerId, clusterId, corridorId, roomId, index, cell, direction, null);
    }

    public DungeonEditorHandleRef {
        kind = kind == null ? DungeonEditorHandleKind.CLUSTER_LABEL : kind;
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        corridorId = Math.max(0L, corridorId);
        roomId = Math.max(0L, roomId);
        index = Math.max(0, index);
        cell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
        direction = direction == null ? "" : direction.trim();
    }

    public static DungeonEditorHandleRef empty() {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                DungeonTopologyElementRef.empty(),
                0L,
                0L,
                0L,
                0L,
                0,
                new DungeonCellRef(0, 0, 0),
                "",
                null);
    }

}
