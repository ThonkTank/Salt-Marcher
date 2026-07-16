package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorMapHitRef;

public final class DungeonEditorGraphHitRefs {
    private DungeonEditorGraphHitRefs() {
    }

    public static DungeonEditorMapHitRef graphNode(long roomId, long clusterId) {
        return new DungeonEditorMapHitRef("graph-node:ROOM:"
                + Math.max(0L, roomId)
                + ":" + Math.max(0L, clusterId));
    }
}
