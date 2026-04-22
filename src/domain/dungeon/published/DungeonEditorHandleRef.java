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
        String direction
) {

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
}
