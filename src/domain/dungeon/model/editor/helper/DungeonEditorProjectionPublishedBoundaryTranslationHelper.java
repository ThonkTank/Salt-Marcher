package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionPublishedBoundaryTranslationHelper {

    private DungeonEditorProjectionPublishedBoundaryTranslationHelper() {
    }

    public static DungeonTopologyKind topology(DungeonEditorWorkspaceValues.TopologyKind topology) {
        return topology != null && topology.isHex()
                ? DungeonTopologyKind.HEX
                : DungeonTopologyKind.SQUARE;
    }

    public static DungeonEditorTopologyElementRef safeTopologyRef(
            DungeonEditorWorkspaceValues.@Nullable TopologyElementRef ref
    ) {
        return DungeonEditorPublishedValueProjectionHelper.toPublishedTopologyRef(
                ref == null ? DungeonEditorWorkspaceValues.TopologyElementRef.empty() : ref);
    }

    public static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
        return DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(emptyWorkspaceHandleRef(ownerId, clusterId));
    }

    public static DungeonEditorWorkspaceValues.HandleRef emptyWorkspaceHandleRef(long ownerId, long clusterId) {
        return new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorWorkspaceValues.HandleKind.fromName(null),
                DungeonEditorWorkspaceValues.TopologyElementRef.empty(),
                ownerId,
                clusterId,
                0L,
                0L,
                0,
                DungeonEditorWorkspaceValues.Cell.empty(),
                "");
    }
}
