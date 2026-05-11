package src.domain.dungeon.model.map.model;

public record DungeonEditorHandleFacts(
        DungeonEditorHandle handle,
        String label
) {

    public DungeonEditorHandleFacts {
        handle = handle == null
                ? new DungeonEditorHandle(
                        DungeonEditorHandleType.CLUSTER_LABEL,
                        DungeonTopologyRef.empty(),
                        0L,
                        0L,
                        0L,
                        0L,
                        0,
                        new DungeonCell(0, 0, 0),
                        DungeonEdgeDirection.NORTH)
                : handle;
        label = label == null || label.isBlank() ? handle.type().name() : label.trim();
    }
}
