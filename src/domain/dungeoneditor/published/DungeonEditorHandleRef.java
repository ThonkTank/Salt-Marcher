package src.domain.dungeoneditor.published;

public record DungeonEditorHandleRef(
        String kind,
        DungeonEditorTopologyElementRef topologyRef,
        long ownerId,
        long clusterId,
        long corridorId,
        long roomId,
        int index,
        DungeonEditorCell cell,
        String direction
) {

    public DungeonEditorHandleRef {
        kind = kind == null || kind.isBlank() ? "CLUSTER_LABEL" : kind.trim();
        topologyRef = topologyRef == null ? DungeonEditorTopologyElementRef.empty() : topologyRef;
        ownerId = Math.max(0L, ownerId);
        clusterId = Math.max(0L, clusterId);
        corridorId = Math.max(0L, corridorId);
        roomId = Math.max(0L, roomId);
        index = Math.max(0, index);
        cell = cell == null ? new DungeonEditorCell(0, 0, 0) : cell;
        direction = direction == null ? "" : direction.trim();
    }

    public static DungeonEditorHandleRef empty() {
        return new DungeonEditorHandleRef(
                "CLUSTER_LABEL",
                DungeonEditorTopologyElementRef.empty(),
                0L,
                0L,
                0L,
                0L,
                0,
                new DungeonEditorCell(0, 0, 0),
                "");
    }
}
