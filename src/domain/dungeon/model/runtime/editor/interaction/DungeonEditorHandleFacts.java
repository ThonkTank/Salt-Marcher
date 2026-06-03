package src.domain.dungeon.model.runtime.editor.interaction;

import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.DungeonTopologyRef;

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
