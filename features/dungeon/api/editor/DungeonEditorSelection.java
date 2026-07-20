package features.dungeon.api.editor;

import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonTopologyElementRef;
import org.jspecify.annotations.Nullable;

/** Stable current selection carried by the single editor state. */
public record DungeonEditorSelection(
        DungeonTopologyElementRef topologyRef,
        long clusterId,
        boolean clusterSelection,
        @Nullable DungeonEditorHandleRef handleRef
) {
    public DungeonEditorSelection {
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        clusterId = Math.max(0L, clusterId);
    }

    public static DungeonEditorSelection empty() {
        return new DungeonEditorSelection(DungeonTopologyElementRef.empty(), 0L, false, null);
    }
}
